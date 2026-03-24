// Advanced Game Features System
// Mini-games, Events, Tournaments, Economy

class GameEvents {
    constructor(io) {
        this.io = io;
        this.events = [];
        this.activeEvents = new Map();
        this.tournaments = new Map();
        this.initializeEvents();
    }

    initializeEvents() {
        // Hourly events
        setInterval(() => this.triggerRandomEvent(), 3600000);
    }

    // Mini-game: Block Building Challenge
    startBuildingChallenge(worldId, timeLimit = 600000) {
        const eventId = `challenge-${Date.now()}`;
        const event = {
            id: eventId,
            type: 'BUILDING_CHALLENGE',
            worldId: worldId,
            startTime: Date.now(),
            endTime: Date.now() + timeLimit,
            participants: [],
            leaderboard: [],
            theme: this.getRandomTheme()
        };
        
        this.activeEvents.set(eventId, event);
        this.io.to(`world-${worldId}`).emit('eventStarted', {
            eventId,
            type: 'BUILDING_CHALLENGE',
            theme: event.theme,
            timeLimit: timeLimit / 1000
        });

        setTimeout(() => this.endBuildingChallenge(eventId), timeLimit);
        return eventId;
    }

    endBuildingChallenge(eventId) {
        const event = this.activeEvents.get(eventId);
        if (event) {
            this.io.to(`world-${event.worldId}`).emit('eventEnded', {
                eventId,
                winners: event.leaderboard.slice(0, 3)
            });
            this.activeEvents.delete(eventId);
        }
    }

    // Mini-game: PvP Arena
    startPvPArena(worldId, maxPlayers = 16) {
        const eventId = `pvp-${Date.now()}`;
        const event = {
            id: eventId,
            type: 'PVP_ARENA',
            worldId: worldId,
            maxPlayers: maxPlayers,
            players: [],
            eliminations: []
        };

        this.activeEvents.set(eventId, event);
        this.io.to(`world-${worldId}`).emit('arenaStarted', {
            eventId,
            maxPlayers: maxPlayers
        });

        return eventId;
    }

    // Tournament System
    createTournament(name, worldId, maxTeams = 8) {
        const tournamentId = `tournament-${Date.now()}`;
        const tournament = {
            id: tournamentId,
            name: name,
            worldId: worldId,
            maxTeams: maxTeams,
            teams: [],
            rounds: [],
            winnerId: null,
            startTime: Date.now(),
            status: 'REGISTRATION'
        };

        this.tournaments.set(tournamentId, tournament);
        this.io.to(`world-${worldId}`).emit('tournamentCreated', {
            tournamentId,
            name: name,
            maxTeams: maxTeams
        });

        // Auto-start after 5 minutes
        setTimeout(() => this.startTournament(tournamentId), 300000);
        return tournamentId;
    }

    startTournament(tournamentId) {
        const tournament = this.tournaments.get(tournamentId);
        if (tournament && tournament.teams.length > 0) {
            tournament.status = 'ACTIVE';
            this.generateTournamentBracket(tournament);
            this.io.to(`world-${tournament.worldId}`).emit('tournamentStarted', {
                tournamentId: tournamentId,
                bracket: tournament.rounds
            });
        }
    }

    generateTournamentBracket(tournament) {
        const teams = [...tournament.teams].sort(() => Math.random() - 0.5);
        let round = 1;
        let currentRound = teams.map((team, i) => ({
            matchId: `match-r${round}-${i}`,
            team1: team,
            team2: teams[i + 1]
        })).filter((_, i) => i % 2 === 0);

        tournament.rounds.push(currentRound);
    }

    // Leaderboard & Ranking System
    updateLeaderboard(worldId, playerId, score) {
        const event = Array.from(this.activeEvents.values()).find(e => e.worldId === worldId);
        if (event && event.leaderboard) {
            event.leaderboard.push({ playerId, score });
            event.leaderboard.sort((a, b) => b.score - a.score);
        }
    }

    // Random event trigger
    triggerRandomEvent() {
        const eventTypes = [
            'METEOR_SHOWER',
            'TREASURE_HUNT',
            'BUILDING_CHALLENGE',
            'SURVIVAL_MODE'
        ];

        const randomEvent = eventTypes[Math.floor(Math.random() * eventTypes.length)];
        console.log(`Triggered event: ${randomEvent}`);
        this.io.emit('eventTriggered', { type: randomEvent });
    }

    getRandomTheme() {
        const themes = [
            'Castle', 'Pyramid', 'Tower', 'Bridge', 'Maze',
            'Garden', 'Statue', 'Monument', 'Fort'
        ];
        return themes[Math.floor(Math.random() * themes.length)];
    }
}

// Player Economy System
class PlayerEconomy {
    constructor(db) {
        this.db = db;
        this.playerCoins = new Map();
    }

    addCoins(playerId, amount) {
        const current = this.playerCoins.get(playerId) || 0;
        this.playerCoins.set(playerId, current + amount);
        return current + amount;
    }

    removeCoins(playerId, amount) {
        const current = this.playerCoins.get(playerId) || 0;
        if (current >= amount) {
            this.playerCoins.set(playerId, current - amount);
            return current - amount;
        }
        return null;
    }

    getBalance(playerId) {
        return this.playerCoins.get(playerId) || 0;
    }

    // Reward for accomplishments
    rewardCompletion(playerId, accomplishment) {
        const rewards = {
            'FIRST_BLOCK': 10,
            'BUILD_FIRST_STRUCTURE': 50,
            'COLLECT_100_BLOCKS': 100,
            'WIN_TOURNAMENT': 500,
            'DAILY_LOGIN': 5
        };

        const reward = rewards[accomplishment] || 0;
        return this.addCoins(playerId, reward);
    }
}

// Achievement System
class AchievementSystem {
    constructor() {
        this.achievements = new Map();
        this.playerAchievements = new Map();
        this.initializeAchievements();
    }

    initializeAchievements() {
        this.achievements.set('FIRST_STEP', {
            id: 'FIRST_STEP',
            name: 'First Step',
            description: 'Place your first block',
            icon: '🧱'
        });
        this.achievements.set('COLLECTOR', {
            id: 'COLLECTOR',
            name: 'Collector',
            description: 'Collect 100 different block types',
            icon: '📦'
        });
        this.achievements.set('ARCHITECT', {
            id: 'ARCHITECT',
            name: 'Architect',
            description: 'Build a structure with 1000 blocks',
            icon: '🏗️'
        });
        this.achievements.set('CHAMPION', {
            id: 'CHAMPION',
            name: 'Champion',
            description: 'Win a tournament',
            icon: '🏆'
        });
    }

    unlockAchievement(playerId, achievementId) {
        if (!this.playerAchievements.has(playerId)) {
            this.playerAchievements.set(playerId, []);
        }
        
        const achievements = this.playerAchievements.get(playerId);
        if (!achievements.includes(achievementId)) {
            achievements.push(achievementId);
            return this.achievements.get(achievementId);
        }
        return null;
    }

    getPlayerAchievements(playerId) {
        return this.playerAchievements.get(playerId) || [];
    }
}

module.exports = {
    GameEvents,
    PlayerEconomy,
    AchievementSystem
};
