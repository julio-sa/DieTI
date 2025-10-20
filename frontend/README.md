# Frontend

This is the frontend web application for the Graduation Project. It interacts with the backend API to present data to users.

## Table of Contents

- [Technologies](#technologies)  
- [Setup & Installation](#setup--installation)  
- [Development](#development)  
- [Building for Production](#building-for-production)  
- [Testing](#testing)  
- [Project Structure](#project-structure)  
- [Contributing](#contributing)  
- [License](#license)

---

## Technologies

- Angular (version 19.2.0)  
- HTML, CSS  
- TypeScript  
- Additional libraries (UI frameworks, state management, etc.)

---

## Setup & Installation

1. Clone the repo:  
   ```bash
   git clone https://github.com/julio-sa/frontend.git
   cd frontend
   ```

2. Install dependencies:  
   ```bash
   npm install
   ```

---

## Development

Run the app in development mode:

```bash
ng serve
```

Then navigate to `http://localhost:4200/`. The app will reload automatically when source files are changed.

---

## Building for Production

To build the project for production:

```bash
ng build
```

The build artifacts will be stored in the `dist/` folder.

---

## Testing

- Run unit tests:

  ```bash
  ng test
  ```

- Run end-to-end tests:

  ```bash
  ng e2e
  ```

---

## Project Structure

```
src/
  app/
    components/
    services/
    ...  
public/            ← static assets  
angular.json  
tsconfig.json  
package.json  
```

---

## Contributing

- Fork the repo  
- Create a branch for the feature/bugfix (`feature/my-feature`)  
- Make your changes  
- Write tests (if applicable)  
- Submit a pull request

---

## License

MIT (or add your chosen license)
