const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { body, validationResult } = require('express-validator');
const winston = require('winston');
const cron = require('node-cron');

const app = express();
const PORT = process.env.PORT || 3000;

// ============================================
// 1. LOGGING & NOTIFICATION SERVICE
// ============================================
const logger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
    ),
    transports: [
        new winston.transports.File({ filename: 'logs/notifications.log' }),
        new winston.transports.Console({ format: winston.format.simple() })
    ]
});

// Notification Service Class
class NotificationService {
    constructor() {
        this.notifications = [];
        this.emailQueue = [];
    }

    sendEmail(to, subject, body, type = 'general') {
        const notification = {
            id: Date.now(),
            type: 'email',
            to,
            subject,
            body,
            status: 'sent',
            timestamp: new Date().toISOString(),
            category: type
        };

        this.notifications.push(notification);
        logger.info('Email notification sent', { to, subject, type, timestamp: notification.timestamp });
        console.log(`\n📧 ========== EMAIL NOTIFICATION ==========`);
        console.log(`To: ${to}`);
        console.log(`Subject: ${subject}`);
        console.log(`Body: ${body}`);
        console.log(`=========================================\n`);
        return notification;
    }

    queueEmail(to, subject, body, type) {
        const queued = { to, subject, body, type, queuedAt: new Date().toISOString() };
        this.emailQueue.push(queued);
        logger.info('Email queued', { to, subject, type });
        return queued;
    }

    processQueue() {
        const batch = [...this.emailQueue];
        this.emailQueue = [];
        batch.forEach(item => this.sendEmail(item.to, item.subject, item.body, item.type));
        logger.info(`Processed ${batch.length} queued emails`);
        return { processed: batch.length };
    }

    getNotifications(type = null) {
        if (type) return this.notifications.filter(n => n.category === type);
        return this.notifications;
    }

    getStats() {
        return {
            total: this.notifications.length,
            byType: {
                registration: this.notifications.filter(n => n.category === 'registration').length,
                fee: this.notifications.filter(n => n.category === 'fee').length,
                results: this.notifications.filter(n => n.category === 'results').length,
                approval: this.notifications.filter(n => n.category === 'approval').length
            },
            queueSize: this.emailQueue.length
        };
    }
}

const notificationService = new NotificationService();

// ============================================
// 2. DATABASE CONFIGURATION
// ============================================
const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://localhost:5432/csu_sis',
    ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false
});

async function initDatabase() {
    const client = await pool.connect();
    try {
        await client.query(`
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                username VARCHAR(100) UNIQUE NOT NULL,
                email VARCHAR(255) UNIQUE NOT NULL,
                password_hash VARCHAR(255) NOT NULL,
                role VARCHAR(50) DEFAULT 'student',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        await client.query(`
            CREATE TABLE IF NOT EXISTS students (
                id SERIAL PRIMARY KEY,
                student_id VARCHAR(20) UNIQUE NOT NULL,
                name VARCHAR(200) NOT NULL,
                email VARCHAR(255) NOT NULL,
                phone VARCHAR(20),
                status VARCHAR(20) DEFAULT 'active',
                registered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        await client.query(`
            CREATE TABLE IF NOT EXISTS courses (
                code VARCHAR(10) PRIMARY KEY,
                name VARCHAR(200) NOT NULL,
                credits INTEGER NOT NULL,
                department VARCHAR(100),
                capacity INTEGER DEFAULT 50
            )
        `);

        await client.query(`
            CREATE TABLE IF NOT EXISTS registrations (
                id SERIAL PRIMARY KEY,
                registration_id VARCHAR(20) UNIQUE NOT NULL,
                student_id INTEGER REFERENCES students(id),
                courses TEXT[],
                total_credits INTEGER,
                fee_amount DECIMAL(10,2),
                status VARCHAR(20) DEFAULT 'pending',
                registered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        await client.query(`
            CREATE TABLE IF NOT EXISTS notifications_log (
                id SERIAL PRIMARY KEY,
                recipient VARCHAR(255),
                type VARCHAR(50),
                subject VARCHAR(500),
                content TEXT,
                status VARCHAR(20),
                sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        await client.query(`
            INSERT INTO courses (code, name, credits, department)
            VALUES
                ('CS101', 'Introduction to Programming', 3, 'Computer Science'),
                ('CS201', 'Data Structures', 3, 'Computer Science'),
                ('MATH101', 'Calculus I', 4, 'Mathematics'),
                ('ENG101', 'Academic Writing', 3, 'English'),
                ('PHY101', 'Physics I', 4, 'Physics'),
                ('BUS101', 'Introduction to Business', 3, 'Business')
            ON CONFLICT (code) DO NOTHING
        `);

        console.log('✓ Database initialized successfully');
    } catch (error) {
        console.error('Database initialization error:', error);
    } finally {
        client.release();
    }
}

// ============================================
// 3. AUTHENTICATION
// ============================================
const JWT_SECRET = process.env.JWT_SECRET || 'university-secret-key-2024';

function generateToken(user) {
    return jwt.sign(
        { id: user.id, username: user.username, role: user.role },
        JWT_SECRET,
        { expiresIn: '24h' }
    );
}

function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Authentication required' });
    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({ error: 'Invalid or expired token' });
        req.user = user;
        next();
    });
}

function requireRole(roles) {
    return (req, res, next) => {
        if (!roles.includes(req.user.role)) return res.status(403).json({ error: 'Insufficient permissions' });
        next();
    };
}

// ============================================
// 4. API INTEGRATION LAYER
// ============================================
class LMSService {
    async enrollStudent(studentId, studentName, courses) {
        const enrollment = {
            lmsId: `LMS_${Date.now()}`,
            studentId,
            studentName,
            courses,
            status: 'enrolled',
            enrolledAt: new Date().toISOString()
        };
        console.log(`\n📚 ========== LMS INTEGRATION ==========`);
        console.log(`Enrolling ${studentName} in LMS`);
        console.log(`Courses: ${courses.join(', ')}`);
        console.log(`LMS Enrollment ID: ${enrollment.lmsId}`);
        console.log(`=======================================\n`);
        logger.info('LMS enrollment', { studentId, studentName, courses });
        return enrollment;
    }
}

class FinanceService {
    async createInvoice(studentId, studentName, amount, registrationId) {
        const invoice = {
            invoiceId: `INV_${Date.now()}`,
            studentId,
            studentName,
            amount,
            registrationId,
            status: 'pending',
            dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
        };
        console.log(`\n💰 ========== FINANCE INTEGRATION ==========`);
        console.log(`Invoice created for ${studentName}`);
        console.log(`Amount: $${amount}`);
        console.log(`Due Date: ${invoice.dueDate}`);
        console.log(`Invoice ID: ${invoice.invoiceId}`);
        console.log(`===========================================\n`);
        notificationService.sendEmail(
            `${studentName.toLowerCase().replace(/\\s/g, '.')}@university.edu`,
            'Fee Payment Notice',
            `Dear ${studentName},\n\nYour fee invoice of $${amount} has been created.\nDue Date: ${invoice.dueDate}\n\nPlease make payment by the due date to avoid late fees.\n\nRegards,\nFinance Department\nCentral State University`,
            'fee'
        );
        logger.info('Finance invoice created', { studentId, studentName, amount });
        return invoice;
    }
}

const lmsService = new LMSService();
const financeService = new FinanceService();

// ============================================
// 5. API ENDPOINTS
// ============================================
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
    next();
});

// Auth endpoints
app.post('/api/auth/register', [
    body('username').isLength({ min: 3 }),
    body('email').isEmail(),
    body('password').isLength({ min: 6 })
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    const { username, email, password, role = 'student' } = req.body;
    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const result = await pool.query(
            'INSERT INTO users (username, email, password_hash, role) VALUES ($1, $2, $3, $4) RETURNING id, username, email, role',
            [username, email, hashedPassword, role]
        );
        const token = generateToken(result.rows[0]);
        res.json({ token, user: result.rows[0] });
    } catch (error) {
        res.status(400).json({ error: 'Username or email already exists' });
    }
});

app.post('/api/auth/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        const result = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
        const user = result.rows[0];
        if (!user || !await bcrypt.compare(password, user.password_hash)) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        const token = generateToken(user);
        res.json({ token, user: { id: user.id, username: user.username, role: user.role } });
    } catch (error) {
        res.status(500).json({ error: 'Login failed' });
    }
});

// Student endpoints
app.get('/api/students', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM students ORDER BY registered_at DESC');
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/students', [
    body('name').notEmpty(),
    body('email').isEmail()
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    const { name, email, phone } = req.body;
    try {
        const count = await pool.query('SELECT COUNT(*) FROM students');
        const studentId = `STU${String(parseInt(count.rows[0].count) + 1).padStart(4, '0')}`;
        const result = await pool.query(
            'INSERT INTO students (student_id, name, email, phone) VALUES ($1, $2, $3, $4) RETURNING *',
            [studentId, name, email, phone || null]
        );
        notificationService.sendEmail(
            email,
            'Welcome to Central State University',
            `Dear ${name},\n\nWelcome to Central State University! Your student ID is ${studentId}.\n\nYou can now register for courses through our SIS portal.\n\nRegards,\nRegistrar's Office`,
            'registration'
        );
        res.json(result.rows[0]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Courses endpoint
app.get('/api/courses', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM courses ORDER BY code');
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Registration endpoint with integrations
app.post('/api/registrations', async (req, res) => {
    const { studentId, studentName, studentEmail, courses } = req.body;
    if (!studentId || !courses || courses.length === 0) {
        return res.status(400).json({ error: 'Missing required fields' });
    }
    try {
        const courseResult = await pool.query('SELECT * FROM courses WHERE code = ANY($1::text[])', [courses]);
        const totalCredits = courseResult.rows.reduce((sum, c) => sum + c.credits, 0);
        const feeAmount = totalCredits * 150;
        const registrationId = `REG${Date.now()}`;
        const result = await pool.query(
            `INSERT INTO registrations (registration_id, student_id, courses, total_credits, fee_amount, status)
             VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
            [registrationId, studentId, courses, totalCredits, feeAmount, 'confirmed']
        );
        const lmsEnrollment = await lmsService.enrollStudent(studentId, studentName, courses);
        const invoice = await financeService.createInvoice(studentId, studentName, feeAmount, registrationId);
        const emailNotification = notificationService.sendEmail(
            studentEmail,
            'Course Registration Confirmed',
            `Dear ${studentName},\n\nYour registration has been confirmed for:\n${courses.map(c => `- ${c}`).join('\n')}\n\nTotal Credits: ${totalCredits}\nTotal Fees: $${feeAmount}\nRegistration ID: ${registrationId}\n\nLMS Enrollment ID: ${lmsEnrollment.lmsId}\nInvoice ID: ${invoice.invoiceId}\n\nYou can now access your courses in the LMS portal.\n\nRegards,\nAcademic Registrar\nCentral State University`,
            'registration'
        );
        res.json({
            success: true,
            registration: result.rows[0],
            integrations: { lms: lmsEnrollment, finance: invoice, notification: emailNotification }
        });
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Notification endpoints
app.get('/api/notifications', authenticateToken, (req, res) => {
    res.json(notificationService.getNotifications());
});

app.get('/api/notifications/stats', authenticateToken, requireRole(['admin']), (req, res) => {
    res.json(notificationService.getStats());
});

app.post('/api/notifications/process-queue', authenticateToken, requireRole(['admin']), (req, res) => {
    res.json(notificationService.processQueue());
});

// Health check
app.get('/api/health', async (req, res) => {
    let dbStatus = 'disconnected';
    try {
        await pool.query('SELECT 1');
        dbStatus = 'connected';
    } catch (e) {
        dbStatus = 'disconnected';
    }
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        platform: 'Render.com PaaS',
        components: {
            database: dbStatus,
            notificationService: notificationService.getStats(),
            lmsIntegration: 'active',
            financeIntegration: 'active',
            authService: 'active'
        }
    });
});

// Scheduled fee reminders
cron.schedule('0 9 * * *', async () => {
    console.log('Running scheduled fee reminder job...');
    try {
        const result = await pool.query(
            `SELECT s.name, s.email, r.registration_id, r.fee_amount, r.registered_at
             FROM registrations r
             JOIN students s ON r.student_id = s.id
             WHERE r.status = 'confirmed'
             AND r.registered_at > NOW() - INTERVAL '30 days'`
        );
        result.rows.forEach(student => {
            notificationService.sendEmail(
                student.email,
                'Fee Payment Reminder',
                `Dear ${student.name},\n\nThis is a reminder that your fee invoice of $${student.fee_amount} is due.\nRegistration ID: ${student.registration_id}\n\nPlease make payment by the due date.\n\nRegards,\nFinance Department`,
                'fee'
            );
        });
        console.log(`Sent ${result.rows.length} fee reminders`);
    } catch (error) {
        console.error('Fee reminder job failed:', error);
    }
});

// Start server
app.listen(PORT, async () => {
    console.log('=========================================');
    console.log('🏫 Central State University SIS - PaaS Solution');
    console.log('=========================================');
    console.log(`✓ Server running on port ${PORT}`);
    console.log(`✓ Platform: Render.com PaaS`);
    console.log(`✓ Database: PostgreSQL Cloud Database`);
    console.log(`✓ Auth: JWT-based Identity Management`);
    console.log(`✓ Notifications: Email + Logging Service`);
    console.log(`✓ Integrations: LMS + Finance (Simulated)`);
    console.log(`=========================================\n`);
    await initDatabase();
});
