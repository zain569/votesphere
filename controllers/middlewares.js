import jwt, { decode } from "jsonwebtoken";

export const authMiddleware = (req, res, next) => {
    try {
        const token = req.cookies.token;

        if (!token) {
            return res.status(401).json({
                message: "Unauthorized User",
                success: false
            })
        } else {
            jwt.verify(token, process.env.SECRET_KEY, (err, decoded) => {
                if (err) {
                    res.status(401).json({
                        message: "Unauthorized User",
                        success: false,
                    })
                } else {
                    req.user = decoded;
                    next();
                }
            })
        }
    } catch (err) {
        console.log(err);
        res.status(500).json({
            message: "Internal Server Error",
            success: false
        })
    }
}