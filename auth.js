import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { 
    getAuth, 
    createUserWithEmailAndPassword, 
    signInWithEmailAndPassword, 
    onAuthStateChanged,
    signOut
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore, doc, setDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// TODO: Replace with your actual Firebase Project Configuration
// You will get this when you create a new web app in your Firebase Console
const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_PROJECT_ID.appspot.com",
    messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
    appId: "YOUR_APP_ID"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

// Helper: Split comma separated strings and clean
const parseSkills = (str) => {
    if (!str) return [];
    return str.split(',').map(s => s.trim().toLowerCase()).filter(s => s !== '');
};

// ============================================================================
// DOM Elements & Event Listeners
// ============================================================================
document.addEventListener('DOMContentLoaded', () => {

    // --- Sign Up Logic ---
    const signupForm = document.getElementById('signup-form');
    if (signupForm) {
        signupForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;
            const username = document.getElementById('username').value;
            const skillsOfferedStr = document.getElementById('skills_offered').value;
            const skillsWantedStr = document.getElementById('skills_wanted').value;
            const bio = document.getElementById('bio').value;
            const errorDiv = document.getElementById('signup-error');
            const submitBtn = document.getElementById('signup-btn');

            submitBtn.innerText = 'Creating account...';
            submitBtn.disabled = true;
            errorDiv.style.display = 'none';

            try {
                // 1. Create Auth User
                const userCredential = await createUserWithEmailAndPassword(auth, email, password);
                const user = userCredential.user;

                // 2. Create User Profile Document in Firestore
                await setDoc(doc(db, "users", user.uid), {
                    uid: user.uid,
                    username: username,
                    email: email,
                    photoURL: `https://api.dicebear.com/7.x/initials/svg?seed=${username}`,
                    skills_offered: parseSkills(skillsOfferedStr),
                    skills_wanted: parseSkills(skillsWantedStr),
                    bio: bio,
                    ratings: 5.0,
                    reviewsCount: 0,
                    swipedRight: [],
                    swipedLeft: [],
                    matches: [],
                    createdAt: new Date().toISOString()
                });

                // 3. Redirect to Dashboard
                window.location.href = 'dashboard.html';

            } catch (error) {
                console.error("Signup error:", error);
                errorDiv.innerText = error.message;
                errorDiv.style.display = 'block';
                submitBtn.innerText = 'Create Free Account';
                submitBtn.disabled = false;
            }
        });
    }

    // --- Login Logic ---
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;
            const errorDiv = document.getElementById('login-error');
            const submitBtn = document.getElementById('login-btn');

            submitBtn.innerText = 'Logging in...';
            submitBtn.disabled = true;
            errorDiv.style.display = 'none';

            try {
                await signInWithEmailAndPassword(auth, email, password);
                window.location.href = 'dashboard.html';
            } catch (error) {
                console.error("Login error:", error);
                errorDiv.innerText = 'Invalid email or password.';
                errorDiv.style.display = 'block';
                submitBtn.innerText = 'Log In';
                submitBtn.disabled = false;
            }
        });
    }

    // --- Logout Logic ---
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            try {
                await signOut(auth);
                window.location.href = 'login.html';
            } catch (error) {
                console.error("Logout error:", error);
            }
        });
    }

});

// ============================================================================
// Auth State Observer
// ============================================================================
// Protect routes. If on a protected page without auth, kick to login.
const protectedPages = ['dashboard.html', 'chat.html', 'call.html'];
const authPages = ['login.html', 'signup.html'];

onAuthStateChanged(auth, (user) => {
    const currentPage = window.location.pathname.split('/').pop();
    
    if (user) {
        // User is signed in.
        // If they are on login or signup, redirect to dashboard.
        if (authPages.includes(currentPage)) {
            window.location.href = 'dashboard.html';
        }
    } else {
        // No user is signed in.
        // If they are on a protected page, kick to login.
        if (protectedPages.includes(currentPage)) {
            window.location.href = 'login.html';
        }
    }
});
