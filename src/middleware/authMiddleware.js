const jwt = require("jsonwebtoken");

const authenticateToken = (req, res, next) => {
    // Jalur 1: Dari Cookie
    let token = req.cookies?.token;

    // Jalur 2: Dari Header Authorization (Bearer Token)
    const authHeader = req.headers['authorization'];
    if (!token && authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.split(' ')[1];
    }

    if (!token) {
        return res.status(401).json({ error: "Sesi habis, silakan login kembali." });
    }

    try {
        const verified = jwt.verify(token, process.env.JWT_SECRET);
        req.user = verified;
        next();
    } catch (err) {
        return res.status(403).json({ error: "Sesi tidak valid." });
    }
};

module.exports = authenticateToken;