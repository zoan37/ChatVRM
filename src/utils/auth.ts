interface RestreamTokens {
    access_token: string;
    refresh_token: string;
}

export async function refreshAccessToken(refreshToken: string): Promise<RestreamTokens> {
    const response = await fetch('/api/refresh-token', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            refresh_token: refreshToken,
        }),
    });

    if (!response.ok) {
        throw new Error('Failed to refresh token');
    }

    return response.json();
} 