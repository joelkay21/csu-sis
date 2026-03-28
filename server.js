const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// In-memory storage (for testing - will work without database)
let students = [];
let registrations = [];
let users = [];
let nextId = 1;
let nextRegId = 1;

// Available courses
const courses = [
    { code: 'CS101', name: 'Introduction to Programming', credits: 3 },
    { code: 'CS201', name: 'Data Structures', credits: 3 },
    { code: 'MATH101', name: 'Calculus I', credits: 4 },
    { code: 'ENG101', name: 'Academic Writing', credits: 3 },
    { code: 'PHY101', name: 'Physics I', credits: 4 },
    { code: 'BUS101', name: 'Introduction to Business', credits: 3 }
];

// ============= API ROUTES =============

// Health check - test if server is working
app.get('/api/health', (req, res) => {
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        platform: 'Render.com PaaS',
        message: 'Server is running!'
    });
});

// Get all students
app.get('/api/students', (req, res) => {
    res.json(students);
});

// Register new student
app.post('/api/students', (req, res) => {
    const { name, email, phone } = req.body;
    
    if (!name || !email) {
        return res.status(400).json({ error: 'Name and email are required' });
    }
    
    const student = {
        id: nextId++,
        student_id: STU,
        name: name,
        email: email,
        phone: phone || '',
        registered_at: new Date().toISOString(),
        status: 'active'
    };
    
    students.push(student);
    res.json(student);
});

// Get all courses
app.get('/api/courses', (req, res) => {
    res.json(courses);
});

// Get all registrations
app.get('/api/registrations', (req, res) => {
    res.json(registrations);
});

// Register student for courses (with simulated integrations)
app.post('/api/registrations', (req, res) => {
    const { studentId, studentName, studentEmail, courses: courseCodes } = req.body;
    
    if (!studentId || !courseCodes || courseCodes.length === 0) {
        return res.status(400).json({ error: 'Missing required fields' });
    }
    
    // Get course details
    const selectedCourses = courses.filter(c => courseCodes.includes(c.code));
    const totalCredits = selectedCourses.reduce((sum, c) => sum + c.credits, 0);
    const feeAmount = totalCredits * 150;
    
    const registration = {
        id: nextRegId++,
        registration_id: REG,
        student_id: studentId,
        student_name: studentName,
        student_email: studentEmail,
        courses: courseCodes,
        total_credits: totalCredits,
        fee_amount: feeAmount,
        registered_at: new Date().toISOString(),
        status: 'confirmed'
    };
    
    registrations.push(registration);
    
    // Simulate LMS Integration
    const lmsEnrollment = {
        lmsId: LMS_,
        studentId: studentId,
        studentName: studentName,
        courses: courseCodes,
        status: 'enrolled'
    };
    
    // Simulate Finance Integration
    const financeInvoice = {
        invoiceId: INV_,
        studentId: studentId,
        studentName: studentName,
        amount: feeAmount,
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        status: 'pending'
    };
    
    // Log to console (will show in Render logs)
    console.log('=========================================');
    console.log('📚 LMS INTEGRATION:');
    console.log(   Enrolled  in: );
    console.log(   LMS ID: );
    console.log('💰 FINANCE INTEGRATION:');
    console.log(   Created invoice for C:\Users\jkatunansa\Desktop\HerokuSIS{feeAmount});
    console.log(   Invoice ID: );
    console.log('📧 NOTIFICATION:');
    console.log(   Sending confirmation email to );
    console.log('=========================================');
    
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
});

// ============= AUTHENTICATION ROUTES =============

// Register new user
app.post('/api/auth/register', (req, res) => {
    const { username, email, password, role } = req.body;
    
    if (!username || !email || !password) {
        return res.status(400).json({ error: 'All fields are required' });
    }
    
    // Check if user exists
    const existingUser = users.find(u => u.username === username || u.email === email);
    if (existingUser) {
        return res.status(400).json({ error: 'Username or email already exists' });
    }
    
    // Simple hash simulation (in production use bcrypt)
    const user = {
        id: users.length + 1,
        username: username,
        email: email,
        password: password, // In production, this should be hashed
        role: role || 'student',
        created_at: new Date().toISOString()
    };
    
    users.push(user);
    
    // Create a simple token (in production use JWT)
    const token = Buffer.from(${username}:).toString('base64');
    
    res.json({
        token: token,
        user: {
            id: user.id,
            username: user.username,
            email: user.email,
            role: user.role
        }
    });
});

// Login user
app.post('/api/auth/login', (req, res) => {
    const { username, password } = req.body;
    
    const user = users.find(u => u.username === username && u.password === password);
    
    if (!user) {
        return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    const token = Buffer.from(${username}:).toString('base64');
    
    res.json({
        token: token,
        user: {
            id: user.id,
            username: user.username,
            email: user.email,
            role: user.role
        }
    });
});

// Serve the main page
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start server
app.listen(PORT, () => {
    console.log('=========================================');
    console.log('🏫 Central State University SIS');
    console.log('=========================================');
    console.log(✓ Server running on port );
    console.log(✓ Platform: Render.com PaaS);
    console.log(✓ API URL: http://localhost:/api/health);
    console.log(✓ Students API: GET /api/students);
    console.log(✓ Courses API: GET /api/courses);
    console.log(✓ Registrations API: GET /api/registrations);
    console.log(✓ Auth API: POST /api/auth/register, POST /api/auth/login);
    console.log('=========================================');
    console.log('\n📚 Simulated Integrations Ready:');
    console.log('   - LMS Service (auto-enrollment)');
    console.log('   - Finance Service (invoice generation)');
    console.log('   - Notification Service (email simulation)');
    console.log('=========================================\n');
});
