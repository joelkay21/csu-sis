const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

// In-memory database (for demonstration)
let students = [];
let registrations = [];
let nextStudentId = 1;
let nextRegistrationId = 1;

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

// Serve main page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Get all students
app.get('/api/students', (req, res) => {
    res.json({
        success: true,
        count: students.length,
        data: students
    });
});

// Register new student
app.post('/api/students', (req, res) => {
    const { name, email } = req.body;
    
    if (!name || !email) {
        return res.status(400).json({
            success: false,
            error: 'Name and email are required'
        });
    }
    
    const newStudent = {
        id: nextStudentId++,
        studentId: `STU${String(nextStudentId).padStart(4, '0')}`,
        name: name,
        email: email,
        registeredAt: new Date().toISOString(),
        status: 'active'
    };
    
    students.push(newStudent);
    
    res.json({
        success: true,
        message: 'Student registered successfully',
        data: newStudent
    });
});

// Get all registrations
app.get('/api/registrations', (req, res) => {
    res.json({
        success: true,
        count: registrations.length,
        data: registrations
    });
});

// Register student for courses
app.post('/api/registrations', (req, res) => {
    const { studentId, studentName, courses: courseCodes } = req.body;
    
    if (!studentId || !courseCodes || courseCodes.length === 0) {
        return res.status(400).json({
            success: false,
            error: 'Student ID and at least one course are required'
        });
    }
    
    // Get course details
    const selectedCourses = courses.filter(c => courseCodes.includes(c.code));
    
    const registration = {
        id: nextRegistrationId++,
        registrationId: `REG${String(nextRegistrationId).padStart(4, '0')}`,
        studentId: studentId,
        studentName: studentName,
        courses: selectedCourses,
        courseCodes: courseCodes,
        registrationDate: new Date().toISOString(),
        status: 'confirmed',
        totalCredits: selectedCourses.reduce((sum, c) => sum + c.credits, 0)
    };
    
    registrations.push(registration);
    
    // Simulate automated communication (for Question 3)
    sendAutomatedNotifications(registration);
    
    res.json({
        success: true,
        message: 'Registration completed successfully',
        data: registration,
        notifications: {
            email: 'Confirmation email sent',
            lms: 'LMS enrollment queued',
            finance: 'Fee record created'
        }
    });
});

// Get specific student's registrations
app.get('/api/students/:studentId/registrations', (req, res) => {
    const studentRegistrations = registrations.filter(r => r.studentId == req.params.studentId);
    res.json({
        success: true,
        count: studentRegistrations.length,
        data: studentRegistrations
    });
});

// Get all courses
app.get('/api/courses', (req, res) => {
    res.json({
        success: true,
        count: courses.length,
        data: courses
    });
});

// System health check
app.get('/api/health', (req, res) => {
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        platform: 'Heroku PaaS',
        version: '1.0.0',
        stats: {
            totalStudents: students.length,
            totalRegistrations: registrations.length,
            activeRegistrations: registrations.filter(r => r.status === 'confirmed').length
        }
    });
});

// Dashboard statistics
app.get('/api/dashboard', (req, res) => {
    const recentRegistrations = [...registrations]
        .reverse()
        .slice(0, 5);
    
    res.json({
        success: true,
        data: {
            totalStudents: students.length,
            totalRegistrations: registrations.length,
            recentRegistrations: recentRegistrations,
            coursePopularity: getCoursePopularity()
        }
    });
});

// Helper function to simulate automated notifications
function sendAutomatedNotifications(registration) {
    console.log('\n========== AUTOMATED NOTIFICATIONS ==========');
    console.log(`Event: Student Registration Confirmed`);
    console.log(`Student: ${registration.studentName} (ID: ${registration.studentId})`);
    console.log(`Courses: ${registration.courses.map(c => c.code).join(', ')}`);
    console.log(`Total Credits: ${registration.totalCredits}`);
    console.log(`\n✓ Email sent to: ${registration.studentName.toLowerCase().replace(/\s/g, '.')}@university.edu`);
    console.log(`✓ LMS enrollment updated`);
    console.log(`✓ Finance record created for fees: $${registration.totalCredits * 150}`);
    console.log(`✓ Academic advisor notified`);
    console.log(`===========================================\n`);
}

// Helper function to calculate course popularity
function getCoursePopularity() {
    const courseCount = {};
    registrations.forEach(reg => {
        reg.courseCodes.forEach(code => {
            courseCount[code] = (courseCount[code] || 0) + 1;
        });
    });
    
    return Object.entries(courseCount)
        .map(([code, count]) => {
            const course = courses.find(c => c.code === code);
            return {
                code: code,
                name: course ? course.name : code,
                registrations: count
            };
        })
        .sort((a, b) => b.registrations - a.registrations);
}

// Start server
app.listen(PORT, () => {
    console.log('=========================================');
    console.log('🏫 Central State University SIS');
    console.log('=========================================');
    console.log(`✓ Server running on port ${PORT}`);
    console.log(`✓ Platform: Heroku PaaS`);
    console.log(`✓ Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`✓ API URL: http://localhost:${PORT}/api`);
    console.log(`✓ Dashboard: http://localhost:${PORT}/api/health`);
    console.log('=========================================\n');
});