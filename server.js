require('dotenv').config();
const express = require('express');
const Database = require('better-sqlite3');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const path = require('path');
const fetch = require('node-fetch');

const app = express();
const PORT = process.env.PORT || 3001;
const DB_PATH = path.join(__dirname, 'data', 'db.sqlite');
const db = new Database(DB_PATH);

// Initialize DB
db.exec(`
  CREATE TABLE IF NOT EXISTS future_monitor_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL,
    user_id INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'static')));

// Middleware to verify JWT
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) return res.sendStatus(401);

    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
        if (err) return res.sendStatus(403);
        req.user = user;
        next();
    });
};

// Register
app.post('/api/register', async (req, res) => {
    const { name, email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

    try {
        const hashedPassword = await bcrypt.hash(password, parseInt(process.env.SALT_ROUNDS) || 10);
        const stmt = db.prepare('INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)');
        const info = stmt.run(name, email, hashedPassword);
        res.status(201).json({ id: info.lastInsertRowid, email });
    } catch (err) {
        if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
            return res.status(409).json({ error: 'Email already exists' });
        }
        res.status(500).json({ error: 'Server error' });
    }
});

// Login
app.post('/api/login', async (req, res) => {
    const { email, password } = req.body;
    const stmt = db.prepare('SELECT * FROM users WHERE email = ?');
    const user = stmt.get(email);

    if (!user) return res.status(400).json({ error: 'User not found' });

    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) return res.status(403).json({ error: 'Invalid password' });

    const token = jwt.sign({ id: user.id, email: user.email }, process.env.JWT_SECRET, { expiresIn: '1h' });
    res.json({ token, user: { id: user.id, name: user.name, email: user.email } });
});

// Add Monitored Identifier
app.post('/api/monitored', authenticateToken, (req, res) => {
    const { identifier } = req.body;
    if (!identifier) return res.status(400).json({ error: 'Identifier required' });

    try {
        const stmt = db.prepare('INSERT INTO monitored_identifiers (user_id, identifier) VALUES (?, ?)');
        const info = stmt.run(req.user.id, identifier);
        res.status(201).json({ id: info.lastInsertRowid, identifier });
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

// List Monitored Identifiers
app.get('/api/monitored', authenticateToken, (req, res) => {
    const stmt = db.prepare('SELECT * FROM monitored_identifiers WHERE user_id = ?');
    const identifiers = stmt.all(req.user.id);
    res.json(identifiers);
});

// Delete Monitored Identifier
app.delete('/api/monitored/:id', authenticateToken, (req, res) => {
    const deleteAlerts = db.prepare('DELETE FROM alerts WHERE identifier_id = ? AND user_id = ?');
    deleteAlerts.run(req.params.id, req.user.id);

    const stmt = db.prepare('DELETE FROM monitored_identifiers WHERE id = ? AND user_id = ?');
    const info = stmt.run(req.params.id, req.user.id);

    if (info.changes === 0) return res.status(404).json({ error: 'Not found' });
    res.json({ success: true });
});

// Check LeakCheck API
app.post('/api/check', authenticateToken, async (req, res) => {
    const stmt = db.prepare('SELECT * FROM monitored_identifiers WHERE user_id = ?');
    const identifiers = stmt.all(req.user.id);
    const apiKey = process.env.LEAKCHECK_API_KEY;

    let newAlerts = 0;

    for (const item of identifiers) {
        try {
            const response = await fetch(`https://leakcheck.io/api/public?key=${apiKey}&check=${encodeURIComponent(item.identifier)}`);
            const data = await response.json();

            if (data.success && data.sources && data.sources.length > 0) {
                const insertAlert = db.prepare(`
                    INSERT INTO alerts (user_id, identifier_id, leak_source, leak_date, details)
                    VALUES (?, ?, ?, ?, ?)
                `);

                for (const source of data.sources) {
                    // Check if alert already exists to avoid duplicates
                    const checkAlert = db.prepare('SELECT id FROM alerts WHERE user_id = ? AND identifier_id = ? AND leak_source = ?');
                    const existing = checkAlert.get(req.user.id, item.id, source.name);

                    if (!existing) {
                        insertAlert.run(req.user.id, item.id, source.name, source.date, JSON.stringify(source));
                        newAlerts++;
                    }
                }
            }
        } catch (err) {
            console.error(`Error checking ${item.identifier}:`, err);
        }
    }

    res.json({ success: true, newAlerts });
});

// Get Alerts
app.get('/api/alerts', authenticateToken, (req, res) => {
    const stmt = db.prepare(`
        SELECT alerts.*, monitored_identifiers.identifier 
        FROM alerts 
        JOIN monitored_identifiers ON alerts.identifier_id = monitored_identifiers.id
        WHERE alerts.user_id = ?
        ORDER BY created_at DESC
    `);
    const alerts = stmt.all(req.user.id);
    res.json(alerts);
});

// Future Monitoring Signup
app.post('/api/notify-signup', authenticateToken, (req, res) => {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email required' });

    try {
        const stmt = db.prepare('INSERT INTO future_monitor_requests (email, user_id) VALUES (?, ?)');
        stmt.run(email, req.user.id);
        res.json({ success: true, message: 'Notification request recorded' });
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});



app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
