// Check if running on localhost
const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

/* if (isLocalhost) {
  console.log("Running on localhost - disabling auth for testing.");

  // Automatically set a fake token for testing
  localStorage.setItem('token', 'test-token');

  // Optionally, redirect to index.html if you're on login or signup page
  if (window.location.pathname.includes('login.html') || window.location.pathname.includes('signup.html')) {
    window.location.href = 'index.html';
  }
} */
const levelSprites = [
  './assets/images/Sprouting.jpg', // Level 1
  './assets/images/Rising.jpg',
  './assets/images/Architect.jpg',
  './assets/images/Early.jpg'
];

const levelTitles = [
  'Sprouting Seed',
  'Rising Wave',
  'Calory Architect',
  'Early Bird'
];

window.addEventListener('DOMContentLoaded', () => {
  const loginLinks = document.querySelector('.login-links');
  const datePicker = document.getElementById('datePicker');

  if (localStorage.getItem('token')) {
    fetch('/api/user', {
      headers: {
        Authorization: `Bearer ${localStorage.getItem('token')}`
      }
    })
    .then(res => res.json())
    .then(user => {
      const level = user.level || 0; // Default to 0 if undefined
      const sprite = levelSprites[level] || levelSprites[0];
      const title = levelTitles[level] || levelTitles[0];

      loginLinks.innerHTML = `
        <img src="${sprite}" alt="Level ${level}" class="sprite-circle" />
        <span>Level ${level + 1}: ${title}</span>
        <button id="logoutBtn">Logout</button>
      `;

      document.getElementById('logoutBtn').addEventListener('click', () => {
        localStorage.removeItem('token');
        localStorage.removeItem('auth');
        window.location.href = 'login.html';
      });

      if (datePicker && !datePicker.value) {
        const today = new Date().toISOString().split('T')[0];
        datePicker.value = today;
      }

      refreshMealsAndEntries();
    });
  }
});

//a level up function so that feature will work coming soon !


//some logic for date stuff
const datePicker = document.getElementById('datePicker');
const prevButton = document.getElementById('prevDay');
const nextButton = document.getElementById('nextDay');
const mealsList = document.getElementById('mealsList');

function formatDate(date) {
  return date.toISOString().split('T')[0];
}

function getCurrentDate() {
  return new Date(datePicker.value);
}

function changeDate(offsetDays) {
  const date = getCurrentDate();
  date.setDate(date.getDate() + offsetDays);
  datePicker.value = formatDate(date);
  refreshMealsAndEntries();
}
//end of date stuff logic
function refreshMealsAndEntries() {
  const token = localStorage.getItem('token');
  const currentDate = document.getElementById('datePicker').value;

  fetch(`/api/meals?date=${currentDate}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
    .then(res => res.json())
    .then(meals => {
      const list = document.getElementById('mealList');
      list.innerHTML = '';

      let totalCalories = 0;

      meals.forEach(meal => {
        // Get calories from .calories or parse from .type
        let calories = meal.calories;
        if (typeof calories === 'undefined' && meal.type) {
          const match = meal.type.match(/^(\d+)\s*cal/i);
          if (match) {
            calories = parseInt(match[1], 10);
          }
        }

        if (!isNaN(calories)) {
          totalCalories += calories;
        }

        const li = document.createElement('li');
        li.textContent = `${meal.name} - ${calories || 'N/A'} cal`;

        // Update button
        const updateBtn = document.createElement('button');
        updateBtn.textContent = 'Update';
        updateBtn.onclick = () => updateEntry(meal.id);

        // Delete button
        const deleteBtn = document.createElement('button');
        deleteBtn.textContent = 'Delete';
        deleteBtn.onclick = () => deleteEntry(meal.id);

        li.append(updateBtn, deleteBtn);
        list.appendChild(li);
      });

      document.getElementById('totalCalories').innerText = totalCalories;
    });
}



if (datePicker) { datePicker.addEventListener('change', refreshMealsAndEntries); }
if (prevButton) { prevButton.addEventListener('click', () => changeDate(-1)); }
if (nextButton) { nextButton.addEventListener('click', () => changeDate(1)); }



const addMealButton = document.getElementById('addButton');
if (addMealButton) {
  addMealButton.addEventListener('click', () => {
    const name = document.getElementById('mealName').value;
    const calories = parseInt(document.getElementById('mealCalories').value, 10);
    const protein = parseInt(document.getElementById('mealProtein').value, 10);
    const date = document.getElementById('datePicker').value; // Get the displayed date

    const token = localStorage.getItem('token'); // ✅ Make sure token is set it does print lol console.loged it
    //so its not getting validated by the back end correctly if its still 401ing

    fetch('/api', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ name, calories, protein, date })
    }).then(refreshMealsAndEntries);
  });
}


// ** old, put most of this functinoality in refresh meals and entries
// Function to refresh the list from the server (GET request)
/* const refreshEntries = () => {
  const token = localStorage.getItem('token');
  const currentDate = document.getElementById('datePicker').value;

  fetch(`/api/meals?date=${currentDate}`, { headers: { Authorization: `Bearer ${token}` } })
    .then(res => res.json())
    .then(entries => {
      const totalCalories = entries.reduce((sum, entry) => {
        const calMatch = entry.type.match(/^(\d+)\s*cal/);
        const calories = calMatch ? parseInt(calMatch[1], 10) : 0;
        return sum + calories;
      }, 0);
      document.getElementById('totalCalories').innerText = totalCalories;
      

      const list = document.getElementById('mealList');
      list.innerHTML = '';

      entries.forEach((entry, index) => {
        const li = document.createElement('li');
        li.textContent = `${entry.name} - ${entry.calories} cal`;

        // Update Button
        const updateBtn = document.createElement('button');
        updateBtn.textContent = 'Update';
        updateBtn.onclick = () => updateEntry(entry.id); // 🧠 Use entry.id not index

        // Delete Button
        const deleteBtn = document.createElement('button');
        deleteBtn.textContent = 'Delete';
        deleteBtn.onclick = () => deleteEntry(entry.id); // 🧠 Use entry.id not index

        li.append(updateBtn, deleteBtn);
        list.appendChild(li);
      });
    });
}; */

if (window.location.pathname === '/index.html') {
  // Call functions for index.html page
  refreshMealsAndEntries();
}



// Why do we have 2 event listeners for addButton??

// // Add food entry (POST request)
// document.getElementById('addButton').addEventListener('click', () => {
//     const foodSelect = document.getElementById('food');
//     const name = foodSelect.value;
//     const calories = parseInt(foodSelect.selectedOptions[0].dataset.calories, 10);

//     fetch('/api', {
//         method: 'POST',
//         headers: { "Content-Type": "application/json" },
//         body: JSON.stringify({ name, calories })
//     })
//     .then(response => response.json())
//     .then(refreshEntries);
// });

// Prevent dropdown click from triggering any unwanted events
const stopPropogating = document.getElementById('food');
if (stopPropogating) {
  stopPropogating.addEventListener('click', (ev) => ev.stopPropagation());
}
// Update an entry (PUT request)
const updateEntry = (id) => {
  const newCalories = prompt("Enter new calorie amount:");
  if (!newCalories || isNaN(newCalories)) return;

  const token = localStorage.getItem('token');
  fetch(`/api/${id}`, {
    method: 'PUT',
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`
    },
    body: JSON.stringify({ calories: Number(newCalories) })
  })
    .then(response => response.json())
    .then(refreshMealsAndEntries);
};
// Delete an entry (Delete request)
const deleteEntry = (id) => {
  const token = localStorage.getItem('token');
  fetch(`/api/${id}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${token}`
    }
  })
    .then(response => response.json())
    .then(refreshMealsAndEntries)
    .catch(err => console.error("Delete error:", err));
};

const signUpEv = document.getElementById('signup');
if (signUpEv) {
  signUpEv.addEventListener('submit', async function (e) {
    e.preventDefault();

    const username = document.getElementById('usernameInput').value;
    const password = document.getElementById('passwordInput').value;

    try {
      const response = await fetch('/api/signup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, password }),
      });

      const data = await response.json();

      if (response.ok) {
        // Successful signup
        alert('User successfully created');
        // Optionally, redirect to another page
        window.location.href = '/login.html'; // Redirect to login page after successful signup
      } else {
        alert('User not created.');
      }
    } catch (error) {
      console.error('Error during signup:', error);
    }

  });
}

const loginEv = document.getElementById('loginForm');
if (loginEv) {
  loginEv.addEventListener('submit', async function (e) {
    e.preventDefault();
    const username = document.getElementById('usernameInput').value;
    const password = document.getElementById('passwordInput').value;
    console.log('in');
    try {
      const response = await fetch('/api/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, password }),
      });

      const data = await response.json();

      if (response.ok) {
        localStorage.setItem('token', data.token); // Store the JWT token
        window.location.href = 'index.html';
      } else {
        console.log('Wrong stuff ');
      }
    } catch (error) {
      console.error('Error logging in:', error);
    }
  });
}
