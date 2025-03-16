# Bracket Night

Bracket Night is a fun and interactive game similar to a Jackbox Party game. Players join the game by scanning a QR code and vote on contestants in a classic tournament bracket. The game is built using TypeScript, with an ExpressJS backend and a NextJS frontend. 

## Features

- **Bracket Setup**: Create a bracket with a title, subtitle, and 16 contestants, each with a small picture.
- **Voting System**: Players vote on contestants, with winners advancing through Quarter Finals, Semi Finals, and Finals.
- **Tie Resolution**: In case of a tie, a random winner is picked.
- **Player Management**: Up to 10 players can join the game via QR code.
- **Bracket Code**: The first player to join can enter a Bracket Code to pre-fill contestants and images.
- **Mobile Friendly**: A mobile-friendly page allows players to enter bracket details and save them to a database.
- **Session Management**: Each device can vote only once per session.
- **Docker Support**: The project includes a Dockerfile for easy distribution.
- **Environment Variables**: Use environment variables to configure the QR code generation.

## Setup Instructions

### Prerequisites

- Node.js
- Docker
- VSCode

### Project Setup

1. **Clone the Repository**
  ```bash
  git clone https://git.helv.io/helvio/bracket-night
  cd bracket-night
  ```

2. **Install Dependencies**
  ```bash
  npm install
  ```

3. **Setup Environment Variables**
  Create a `.env` file in the root directory and add the following variables:
  ```env
  PUBLIC_HOST=https://bracket.my.domain
  ```

4. **Configure TypeScript**
  Ensure `tsconfig.json` is properly set up for the project.

5. **Folder Structure**
  ```
  bracket-night/
  ├── backend/
  │   ├── controllers/
  │   ├── models/
  │   ├── routes/
  │   ├── services/
  │   ├── config.ts
  │   └── server.ts
  ├── frontend/
  │   ├── components/
  │   ├── pages/
  │   ├── public/
  │   ├── styles/
  │   └── next.config.js
  ├── Dockerfile
  ├── .env
  ├── package.json
  └── README.md
  ```

6. **Run the Project**
  ```bash
  npm run dev
  ```

### Docker Setup

1. **Build Docker Image**
  ```bash
  docker build -t bracket-night .
  ```

2. **Run Docker Container**
  ```bash
  docker run -p 3000:3000 --env-file .env bracket-night
  ```

## Usage

- **Main Page**: Opens the bracket screen with a random QR code for session attachment.
- **Mobile Page**: Redirects to the contestants form at `/new` if accessed via a mobile device.

## Development Notes

- **TypeScript**: Use 2-space indentation and avoid semicolons.
- **Database**: Use SQLite for storing bracket details and session management.
- **Effects**: Add pleasant night-time colors and effects to enhance the game experience.

## Contributing

Feel free to submit issues and pull requests to improve the project.

## License

This project is licensed under the MIT License.
