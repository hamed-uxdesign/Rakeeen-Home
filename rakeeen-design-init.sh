#!/bin/bash

# Rakeeen Brutalist Design System Initializer
# Designed for quick migration of Tailwind CSS + React projects to Rakeeen's signature Brutalist Lime theme.

echo "🚀 Starting Rakeeen Design System setup..."

# 1. Locate CSS File (support common paths)
CSS_PATH=""
if [ -f "src/styles/global.css" ]; then
  CSS_PATH="src/styles/global.css"
elif [ -f "src/index.css" ]; then
  CSS_PATH="src/index.css"
elif [ -f "src/global.css" ]; then
  CSS_PATH="src/global.css"
else
  echo "⚠️ CSS file not found in common locations. Creating src/index.css..."
  mkdir -p src
  touch src/index.css
  CSS_PATH="src/index.css"
fi

echo "🎯 Targeting CSS file: $CSS_PATH"

# 2. Inject Rakeeen CSS design system parameters
cat << 'EOF' > "$CSS_PATH"
@import url('https://api.fontshare.com/v2/css?f[]=general-sans@200,300,400,500,600,700,900&display=swap');
@import url('https://fonts.googleapis.com/css2?family=Geist+Mono:wght@100..900&display=swap');
@import "tailwindcss";

@theme {
  --font-sans: "General Sans Variable", "Inter", sans-serif;
  --font-mono: "Geist Mono", monospace;

  /* Signature Rakeeen Lime Palette */
  --lime-bg: #E7E8E1;
  --lime-50: #FBFDE8;
  --lime-100: #F4F9CE;
  --lime-200: #E9F4A2;
  --lime-300: #D7EA6C;
  --lime-400: #C2DC3F;
  --lime-500: #A5C220;
  --lime-600: #809B15;
  --lime-700: #617615;
  --lime-800: #4E5E16;
  --lime-900: #425017;
  --lime-950: #222C07;
}

@layer base {
  :root {
    --bg: #E7E8E1;
    --paper: #E7E8E1;
    --paper-dark: #ffffff;
    --ink: #222C07;
    --ink-faded: #4E5E16;
    --sepia: #C2DC3F;
    --rust: #809B15;
    --forest: #A5C220;
  }

  body.dark-theme {
    --bg: #0D0D0D;
    --paper: #0D0D0D;
    --paper-dark: #000000;
    --ink: #E7E8E1;
    --ink-faded: #A5C220;
    --sepia: #C2DC3F;
    --rust: #617615;
    --forest: #4E5E16;
  }

  body {
    background: var(--paper);
    color: var(--ink);
    font-family: var(--font-sans);
    min-height: 100vh;
    transition: background-color 0.3s ease, color 0.3s ease;
  }
}

@layer utilities {
  .font-sans-main { font-family: var(--font-sans), sans-serif; }
  .font-mono-main { font-family: var(--font-mono), monospace; }

  /* Premium Bold Brutalist Button */
  .btn-brutalist {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-family: var(--font-mono), monospace;
    font-weight: 900;
    text-transform: uppercase;
    transition: all 0.2s ease;
    background: var(--sepia);
    color: #222C07 !important;
    border: 1px solid var(--ink);
    border-radius: 0px;
    padding: 0.6rem 1.5rem;
    font-size: 0.85rem;
    letter-spacing: 0.05em;
    cursor: pointer;
    outline: none;
  }
  .btn-brutalist:hover {
    background: var(--lime-300);
    transform: translate(-2px, -2px);
    box-shadow: 3px 3px 0px 0px var(--ink);
  }
  .btn-brutalist:active {
    transform: translate(0, 0);
    box-shadow: none;
  }

  /* Premium Flat Brutalist Card */
  .brutalist-card {
    background: var(--paper-dark);
    border: 1px solid var(--ink);
    border-radius: 0px;
    padding: 2rem;
    position: relative;
    transition: box-shadow 0.2s ease, transform 0.2s ease;
  }
  .brutalist-card:hover:not(.no-lift) {
    transform: translate(-4px, -4px);
    box-shadow: 6px 6px 0px 0px var(--ink);
  }

  .brutalist-dashed-card {
    background: var(--paper-dark);
    border: 1px dashed var(--ink);
    border-radius: 0px;
    padding: 2.5rem;
    position: relative;
    transition: box-shadow 0.2s ease, transform 0.2s ease;
  }
  .brutalist-dashed-card:hover:not(.no-lift) {
    transform: translate(-3px, -3px);
    box-shadow: 6px 6px 0px 0px var(--ink);
  }
}
EOF

echo "✨ Design system classes injected into $CSS_PATH!"

# 3. Create a Demo Button component to test
mkdir -p src/components/ui
cat << 'EOF' > src/components/ui/BrutalistButton.tsx
import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
}

export const BrutalistButton: React.FC<ButtonProps> = ({ children, className = '', ...props }) => {
  return (
    <button 
      className={`btn-brutalist ${className}`}
      {...props}
    >
      {children}
    </button>
  );
};
EOF

echo "📦 Generated UI Component: src/components/ui/BrutalistButton.tsx"
echo "🎉 Setup complete! Run your dev server to see the Rakeeen Brutalist Design System in action."
