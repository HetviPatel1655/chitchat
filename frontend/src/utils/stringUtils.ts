/**
 * Personalizes system messages by replacing a username with "You" or "you".
 * 
 * Examples:
 * - "Alice added Bob" -> "You added Bob" (for Alice)
 * - "Alice added Bob" -> "Alice added you" (for Bob)
 * 
 * @param content The original system message content
 * @param username The current user's username
 * @returns Personalized message
 */
export const formatSystemMessage = (content: string, username?: string): string => {
    if (!username || !content) return content;

    // Use regex with word boundaries to avoid partial matches
    const escapedUsername = username.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`\\b${escapedUsername}\\b`, 'gi');

    return content.replace(regex, (_match, offset) => {
        // If it's at the start of the string, use "You"
        if (offset === 0) return "You";
        // Otherwise use "you"
        return "you";
    });
};
