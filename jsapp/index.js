#!/usr/bin/env node

const http = require('http');
const fs = require('fs');
const { createHmac, randomUUID } = require('crypto');
const Database = require('better-sqlite3');
const db = new Database('mydb.sqlite');
const express = require('express');
const bcrypt = require('bcryptjs');
const basicAuth = require('basic-auth');
const path = require('path');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const dayjs = require('dayjs')


// const secret = 'abcdefg';
// const hash = (str) => createHmac('sha256', secret).update(str).digest('hex');

// Creating table for meals 
db.prepare(`CREATE TABLE IF NOT EXISTS meals (
    id TEXT PRIMARY KEY,
    name TEXT,
    type TEXT,
    date TEXT 
)`).run(); // updated to contain date


// Creating table for passwords
db.prepare(`CREATE TABLE IF NOT EXISTS users (
    username TEXT PRIMARY KEY, 
    password TEXT, 
    level TEXT
)`).run();

// I dont think I need this, keeping just to make sure. 
// const authenticate = (auth = '') => {
//   const [user, pass] = Buffer.from(auth.slice(6), 'base64').toString().split(':');
//   return new Promise((resolve) => {
//     db.get('SELECT * FROM users WHERE username = ? AND password = ?', [user, hash(pass + user)], (err, row) => {
//       if (err || !row) return resolve(null);
//       resolve(row);
//     });
//   });
// };


const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, '../html')));
app.use(cors());

const USERS_FILE = 'passwd.sqlite';
let foodLog = [];
let users = {};

// Load SSL certificates
const options = {
    key: fs.readFileSync('ssl/key.pem'),
    cert: fs.readFileSync('ssl/cert.pem')
};

// Load users from file
const loadUsers = () => {
    users = {};
    const rows = db.prepare("SELECT username, password FROM users").all();
    for (const row of rows) {
        users[row.username] = { password: row.password };
    }
    console.log(users);
};
loadUsers();


// Authentication middleware
/* const auth = (req, res, next) => {
    //console.log('HEADERS:', req.headers); // some logging so i can try and figure out why the req isnt coming though right
    const user = basicAuth(req);
    //console.log('PARSED USER:', user);
    if (!user || !users[user.name]) return res.status(401).json({ error: "Unauthorized" });

    bcrypt.compare(user.pass, users[user.name].password, (err, result) => {
        if (err || !result) return res.status(401).json({ error: "Unauthorized" });
        req.user = users[user.name];
        next();
    });
}; */

// made a new auth function that works with jwt instead ot basic auth
const secret = 'your-secret-key'; // should use process.env.SECRET in production

const auth = (req, res, next) => {
    const authHeader = req.headers['authorization'];

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Unauthorized - No token provided' });
    }

    const token = authHeader.split(' ')[1];

    try {
        const decoded = jwt.verify(token, secret);
        req.user = decoded; // Now req.user = { username, id }
        next();
    } catch (err) {
        return res.status(403).json({ error: 'Invalid or expired token' });
    }
};

function generateJWT(user) {
    const payload = { username: user.username, id: user.id }; // Payload with user info
    const secret = 'your-secret-key'; // Use an environment variable for production
    const options = { expiresIn: '1h' }; // Token expiration (optional)

    // Generate and return the JWT
    return jwt.sign(payload, secret, options);
}

// Function that lets a user signup, hashes/salts password then creates a new user in db. 
app.post('/api/signup', async (req, res) => {
    // Getting the username and pass form frontend, then checking to make sure its there
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ message: 'Need to provide username and password.' });
    }

    // Open up the database, then check if the specific user is aleady there. 
    const getUser = db.prepare('SELECT * FROM users WHERE username = ?');
    const existingUser = getUser.get(username);

    if (existingUser) {
        return res.status(400).json({ message: 'Username is already taken' });
    }

    // Salting and hashing the password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Get DB ready to add a new user
    const insertUser = db.prepare('INSERT INTO users (username, password) VALUES (?, ?)');
    try {
        insertUser.run(username, hashedPassword);
        return res.status(201).json({ message: 'User created!' });
    } catch {
        console.error(error);
        return res.status(500).json({ message: 'Error occured while adding to user. ' });
    }
});

app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;

    const getUser = db.prepare('SELECT * FROM users WHERE username = ?');
    const user = getUser.get(username);

    // Check is username and password exist/match
    if (user && await bcrypt.compare(password, user.password)) {
        // Generate json web token
        const token = generateJWT(user);

        res.status(200).json({
            message: 'Login successful',
            token: token, // Send back the token
        });
    } else {
        res.status(401).json({
            message: 'Invalid username or password',
        });
    }
});
// puerely for user level stuff
// when we call auth, req.user = { username, id }
app.get('/api/user', auth, (req, res) => {
    const user = db.prepare('SELECT username, level FROM users WHERE username = ?').get(req.user.username);
    res.json(user);
});

app.get('/api/meals', auth, (req, res) => {
    const date = req.query.date || dayjs().format('YYYY-MM-DD');

    try {
        const rows = db.prepare('SELECT * FROM meals WHERE date = ?').all(date);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/* app.get('/api/meals', (req, res) => {
    try {
        const rows = db.prepare('SELECT * FROM meals').all();
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
}); */

// Add food entry (Authenticated: Author/Admin)
// new add food that goes to meal db instead of local memory
app.post('/api', auth, (req, res) => {
    const { name, calories, protein, date } = req.body;
    const mealDate = date || dayjs().format('YYYY-MM-DD');

    if (!name || !calories) return res.status(400).json({ error: "Invalid data" });

    try {
        const id = randomUUID();
        const stmt = db.prepare('INSERT INTO meals (id, name, type, date) VALUES (?, ?, ?, ?)');
        stmt.run(id, name, `${calories} cal, ${protein || 0}g protein`, mealDate);

        res.status(201).json({ id, name, calories, protein, date: mealDate });
    } catch (err) {
        console.error('DB Insert Error:', err);
        res.status(500).json({ error: 'Failed to insert meal into database' });
    }
});
// OLD VERSION below
/* app.post('/api', auth, (req, res) => {
    const { name, calories, protein } = req.body;

    if (!name || !calories) return res.status(400).json({ error: "Invalid data" });

    try {
        const id = randomUUID();
        const stmt = db.prepare('INSERT INTO meals (id, name, type) VALUES (?, ?, ?)');
        stmt.run(id, name, `${calories} cal, ${protein || 0}g protein`);
        
        res.status(201).json({ id, name, calories, protein });
    } catch (err) {
        console.error('DB Insert Error:', err);
        res.status(500).json({ error: 'Failed to insert meal into database' });
    }
}); */


// Update food entry (Authenticated: Author/Admin)
app.put('/api/:id', auth, (req, res) => {
    const { id } = req.params;
    const { calories, protein } = req.body;

    // Get the existing meal first
    const existingMeal = db.prepare('SELECT * FROM meals WHERE id = ?').get(id);
    if (!existingMeal) {
        return res.status(404).json({ error: 'Meal not found' });
    }

    // Parse existing type string
    const typeParts = existingMeal.type.split(',');
    let currentCalories = 0;
    let currentProtein = 0;

    for (const part of typeParts) {
        if (/cal/.test(part)) currentCalories = parseInt(part);
        if (/protein/.test(part)) currentProtein = parseInt(part);
    }

    // Use new values if provided
    const newCalories = typeof calories === 'number' ? calories : currentCalories;
    const newProtein = typeof protein === 'number' ? protein : currentProtein;
    const newType = `${newCalories} cal, ${newProtein}g protein`;

    // Update in DB
    const result = db.prepare('UPDATE meals SET type = ? WHERE id = ?').run(newType, id);

    if (result.changes === 0) {
        return res.status(500).json({ error: 'Failed to update meal' });
    }

    res.json({ message: 'Meal updated successfully' });
});


// Delete food entry (Authenticated: Author/Admin)
app.delete('/api/:id', auth, (req, res) => {
    const { id } = req.params;

    const result = db.prepare('DELETE FROM meals WHERE id = ?').run(id);

    if (result.changes === 0) {
        return res.status(404).json({ error: 'Meal not found' });
    }

    res.json({ message: 'Meal deleted successfully' });
});





// Start HTTPS Server
http.createServer(options, app).listen(3000, () => console.log("Server running on https://localhost:3000"));


