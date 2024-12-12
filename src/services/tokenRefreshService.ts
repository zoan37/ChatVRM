import EventEmitter from 'events';
import { refreshAccessToken } from '../utils/auth';
import { websocketService } from './websocketService';
import Cookies from 'js-cookie';

class TokenRefreshService extends EventEmitter {
    private refreshInterval: NodeJS.Timeout | null = null;
    private currentTokens: any = null;

    private saveTokensToCookies(tokens: any) {
        if (!tokens.access_token || !tokens.refresh_token) {
            console.error('Invalid token format');
            return;
        }

        const formattedJson = JSON.stringify(tokens, null, 2);
        Cookies.set('restream_tokens', formattedJson, { expires: 30 });
    }

    startAutoRefresh(tokens: any, onTokensUpdate: (tokens: any) => void) {
        this.currentTokens = tokens;
        
        // Clear any existing interval
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
        }

        // Set up auto-refresh every 50 minutes (tokens expire after 1 hour)
        this.refreshInterval = setInterval(async () => {
            try {
                const newTokens = await refreshAccessToken(this.currentTokens.refresh_token);
                this.currentTokens = newTokens;
                
                // Save new tokens to cookies
                this.saveTokensToCookies(newTokens);
                
                // Use reconnectWithNewToken instead of manual connect/disconnect
                await websocketService.reconnectWithNewToken(newTokens.access_token);
                
                // Update tokens in parent component
                onTokensUpdate(newTokens);
                
                // Emit event for token refresh
                this.emit('tokensRefreshed', newTokens);
            } catch (error) {
                console.error('Failed to refresh tokens:', error);
            }
        }, 15000); // 50 minutes
    }

    stopAutoRefresh() {
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
            this.refreshInterval = null;
        }
        this.currentTokens = null;
    }
}

export const tokenRefreshService = new TokenRefreshService(); 