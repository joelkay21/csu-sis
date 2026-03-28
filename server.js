const express = require('express');
const cors = require('cors');
const path = require('path');
const { Pool } = require('pg');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Database connection
let pool = null;
let dbConnected = false;

if (process.env.DATABASE_URL) {
    try {
        pool = new Pool({
            connectionString: process.env.DATABASE_URL,
            ssl: { rejectUnauthorized: false }
        });
        
        pool.connect((err, client, release) => {
            if (err) {
                console.error('Database connection failed:', err.message);
                dbConnected = false;
            } else {
                console.log('PostgreSQL database connected');
                dbConnected = true;
                release();
                initDatabase();
            }
        });
    } catch (err) {
        console.error('Database pool error:', err.message);
        dbConnected = false;
    }
} else {
    console.log('No DATABASE_URL - using in-memory storage');
}

// Default courses
const defaultCourses = [
    { code: 'CS101', name: 'Introduction to Programming', credits: 3 },
    { code: 'CS201', name: 'Data Structures', credits: 3 },
    { code: 'MATH101', name: 'Calculus I', credits: 4 },
    { code: 'ENG101', name: 'Academic Writing', credits: 3 },
    { code: 'PHY101', name: 'Physics I', credits: 4 },
    { code: 'BUS101', name: 'Introduction to Business', credits: 3 }
];

// In-memory fallback storage
let students = [];
let registrations = [];
let users = [];
let nextStudentId = 1;
let nextRegId = 1;

// Initialize database tables
async function initDatabase() {
    if (!pool) return;
    
    try {
        await pool.query(\
            CREATE TABLE IF NOT EXISTS students (
                id SERIAL PRIMARY KEY,
                student_id VARCHAR(20) UNIQUE NOT NULL,
                name VARCHAR(200) NOT NULL,
                email VARCHAR(255) NOT NULL,
                phone VARCHAR(50),
                registered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                status VARCHAR(20) DEFAULT 'active'
            )
        \);
        
        await pool.query(\
            CREATE TABLE IF NOT EXISTS courses (
                code VARCHAR(10) PRIMARY KEY,
                name VARCHAR(200) NOT NULL,
                credits INTEGER NOT NULL
            )
        \);
        
        await pool.query(\
            CREATE TABLE IF NOT EXISTS registrations (
                id SERIAL PRIMARY KEY,
                registration_id VARCHAR(50) UNIQUE NOT NULL,
                student_id INTEGER,
                student_name VARCHAR(200),
                courses TEXT[],
                total_credits INTEGER,
                fee_amount DECIMAL(10,2),
                registered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                status VARCHAR(20) DEFAULT 'confirmed'
            )
        \);
        
        await pool.query(\
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                username VARCHAR(100) UNIQUE NOT NULL,
                email VARCHAR(255) UNIQUE NOT NULL,
                password VARCHAR(255) NOT NULL,
                role VARCHAR(50) DEFAULT 'student',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        \);
        
        for (const course of defaultCourses) {
            await pool.query(
                'INSERT INTO courses (code, name, credits) VALUES (, , ) ON CONFLICT (code) DO NOTHING',
                [course.code, course.name, course.credits]
            );
        }
        
        console.log('Database tables ready');
    } catch (err) {
        console.error('Database init error:', err.message);
    }
}

// ============= API ROUTES =============

app.get('/api/health', async (req, res) => {
    let dbStatus = 'not_configured';
    if (pool) {
        try {
            await pool.query('SELECT 1');
            dbStatus = 'connected';
        } catch (e) {
            dbStatus = 'disconnected';
        }
    }
    
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        platform: 'Render.com PaaS',
        database: dbStatus,
        storage: dbConnected ? 'postgresql' : 'in-memory'
    });
});

app.get('/api/students', async (req, res) => {
    try {
        if (dbConnected && pool) {
            const result = await pool.query('SELECT * FROM students ORDER BY registered_at DESC');
            res.json(result.rows);
        } else {
            res.json(students);
        }
    } catch (err) {
        console.error('GET students error:', err.message);
        res.json(students);
    }
});

app.post('/api/students', async (req, res) => {
    try {
        const { name, email, phone } = req.body;
        
        if (!name || !email) {
            return res.status(400).json({ error: 'Name and email are required' });
        }
        
        if (dbConnected && pool) {
            const countResult = await pool.query('SELECT COUNT(*) FROM students');
            const count = parseInt(countResult.rows[0].count);
            const studentId = 'STU' + String(count + 1).padStart(4, '0');
            
            const result = await pool.query(
                'INSERT INTO students (student_id, name, email, phone) VALUES (, , , ) RETURNING *',
                [studentId, name, email, phone || '']
            );
            res.json(result.rows[0]);
        } else {
            const student = {
                id: nextStudentId,
                student_id: 'STU' + String(nextStudentId).padStart(4, '0'),
                name: name,
                email: email,
                phone: phone || '',
                registered_at: new Date().toISOString()
            };
            students.push(student);
            nextStudentId++;
            res.json(student);
        }
    } catch (err) {
        console.error('POST students error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/courses', async (req, res) => {
    try {
        if (dbConnected && pool) {
            const result = await pool.query('SELECT * FROM courses ORDER BY code');
            if (result.rows.length > 0) {
                res.json(result.rows);
            } else {
                res.json(defaultCourses);
            }
        } else {
            res.json(defaultCourses);
        }
    } catch (err) {
        res.json(defaultCourses);
    }
});

app.get('/api/registrations', async (req, res) => {
    try {
        if (dbConnected && pool) {
            const result = await pool.query('SELECT * FROM registrations ORDER BY registered_at DESC');
            res.json(result.rows);
        } else {
            res.json(registrations);
        }
    } catch (err) {
        res.json(registrations);
    }
});

app.post('/api/registrations', async (req, res) => {
    try {
        const { studentId, studentName, studentEmail, courses: courseCodes } = req.body;
        
        if (!studentId || !courseCodes || courseCodes.length === 0) {
            return res.status(400).json({ error: 'Missing required fields' });
        }
        
        const selectedCourses = defaultCourses.filter(c => courseCodes.includes(c.code));
        const totalCredits = selectedCourses.reduce((sum, c) => sum + c.credits, 0);
        const feeAmount = totalCredits * 150;
        const registrationId = 'REG' + Date.now();
        
        let registration;
        
        if (dbConnected && pool) {
            const result = await pool.query(
                'INSERT INTO registrations (registration_id, student_id, student_name, courses, total_credits, fee_amount) VALUES (, , , , , ) RETURNING *',
                [registrationId, studentId, studentName, courseCodes, totalCredits, feeAmount]
            );
            registration = result.rows[0];
        } else {
            registration = {
                id: nextRegId,
                registration_id: registrationId,
                student_id: studentId,
                student_name: studentName,
                courses: courseCodes,
                total_credits: totalCredits,
                fee_amount: feeAmount,
                registered_at: new Date().toISOString()
            };
            registrations.push(registration);
            nextRegId++;
        }
        
        // Simulated integrations
        const lmsEnrollment = {
            lmsId: 'LMS_' + Date.now(),
            studentId: studentId,
            studentName: studentName,
            courses: courseCodes,
            status: 'enrolled'
        };
        
        const financeInvoice = {
            invoiceId: 'INV_' + Date.now(),
            studentId: studentId,
            studentName: studentName,
            amount: feeAmount,
            dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
            status: 'pending'
        };
        
        console.log('');
        console.log('========== INTEGRATIONS ==========');
        console.log('LMS Integration: Enrolled ' + studentName + ' in ' + courseCodes.join(', '));
        console.log('Finance Integration: Created invoice for $' + feeAmount);
        console.log('Notification: Confirmation email sent to ' + studentEmail);
        console.log('===================================');
        console.log('');
        
        res.json({
            success: true,
            message: 'Registration completed successfully',
            registration: registration,
            integrations: {
                lms: lmsEnrollment,
                finance: financeInvoice,
                notification: {
                    status: 'sent',
                    email: studentEmail,
                    subject: 'Course Registration Confirmation'
                }
            }
        });
    } catch (err) {
        console.error('POST registrations error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// Auth routes
app.post('/api/auth/register', async (req, res) => {
    try {
        const { username, email, password, role } = req.body;
        
        if (!username || !email || !password) {
            return res.status(400).json({ error: 'All fields required' });
        }
        
        let user;
        
        if (dbConnected && pool) {
            const existing = await pool.query('SELECT * FROM users WHERE username =  OR email = ', [username, email]);
            if (existing.rows.length > 0) {
                return res.status(400).json({ error: 'Username or email exists' });
            }
            const result = await pool.query(
                'INSERT INTO users (username, email, password, role) VALUES (, , , ) RETURNING id, username, email, role',
                [username, email, password, role || 'student']
            );
            user = result.rows[0];
        } else {
            const existing = users.find(u => u.username === username || u.email === email);
            if (existing) {
                return res.status(400).json({ error: 'Username or email exists' });
            }
            user = { id: users.length + 1, username: username, email: email, role: role || 'student' };
            users.push(user);
        }
        
        const token = Buffer.from(username + ':' + Date.now()).toString('base64');
        res.json({ token: token, user: user });
    } catch (err) {
        console.error('Auth register error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/auth/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        let user;
        
        if (dbConnected && pool) {
            const result = await pool.query('SELECT * FROM users WHERE username =  AND password = ', [username, password]);
            if (result.rows.length === 0) {
                return res.status(401).json({ error: 'Invalid credentials' });
            }
            user = result.rows[0];
        } else {
            user = users.find(u => u.username === username && u.password === password);
            if (!user) {
                return res.status(401).json({ error: 'Invalid credentials' });
            }
        }
        
        const token = Buffer.from(username + ':' + Date.now()).toString('base64');
        res.json({
            token: token,
            user: {
                id: user.id,
                username: user.username,
                email: user.email,
                role: user.role
            }
        });
    } catch (err) {
        console.error('Auth login error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// Serve frontend
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start server
app.listen(PORT, () => {
    console.log('=========================================');
    console.log('Central State University SIS');
    console.log('=========================================');
    console.log('Server running on port ' + PORT);
    console.log('Database: ' + (dbConnected ? 'PostgreSQL connected' : 'In-memory mode'));
    console.log('=========================================');
});
