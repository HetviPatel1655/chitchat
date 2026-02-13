import jwt from "jsonwebtoken";

export const generateJWT = (payload: { id: string }) => {
    const secret = process.env.JWT_SECRET || "your_secret_key";

    // Generate token with 7 days expiration
    const token = jwt.sign(payload, secret, {
        expiresIn: "7d"  // Token valid for 7 days
    });

    return token;
};

export const verifyJWT = (token: string) => {
    const secret = process.env.JWT_SECRET || "your_secret_key";

    try {
        const decoded = jwt.verify(token, secret);
        return decoded;
    } catch (error) {
        console.error("JWT Verification Error:", error);
        throw new Error("Token verification failed");
    }
};
