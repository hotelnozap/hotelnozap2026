const fs = require('fs');

const css = `@tailwind base;
@tailwind components;
@tailwind utilities;

@layer utilities {
  /* Hide scrollbar for Chrome, Safari and Opera */
  .no-scrollbar::-webkit-scrollbar {
    display: none;
  }
  /* Hide scrollbar for IE, Edge and Firefox */
  .no-scrollbar {
    -ms-overflow-style: none;  /* IE and Edge */
    scrollbar-width: none;  /* Firefox */
  }
}

body {
  margin: 0;
  min-height: 100vh;
  font-family: 'Inter', sans-serif;
  background-color: #f8f9ff;
  color: #0b1c30;
}
`;

fs.writeFileSync('src/index.css', css, 'utf8');

// Now update App.tsx to use no-scrollbar on nav and aside
let appCode = fs.readFileSync('src/App.tsx', 'utf8');
appCode = appCode.replace('overflow-y-auto pr-1', 'overflow-y-auto no-scrollbar');
appCode = appCode.replace('gap-2 z-40 bg-gradient-to-b', 'gap-1.5 z-40 bg-gradient-to-b');
appCode = appCode.replace(/py-3 rounded-lg/g, 'py-2.5 rounded-lg');
fs.writeFileSync('src/App.tsx', appCode, 'utf8');

console.log('Barra de rolagem ocultada com sucesso!');
