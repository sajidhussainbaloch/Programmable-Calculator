# ProCalc — Professional Programmable Scientific Calculator

A full-featured programmable scientific calculator built with vanilla HTML, CSS, and JavaScript. No dependencies, no build step — just open and use.

![Calculator Screenshot](https://img.shields.io/badge/status-live-brightgreen)
![License](https://img.shields.io/badge/license-MIT-blue)

🌐 **Live Demo:** [https://programmable-calculator-lj17ndtcy.vercel.app](https://programmable-calculator-lj17ndtcy.vercel.app)

---

## ✨ Features

### 🔢 Scientific Calculator
- **Basic arithmetic**: `+`, `−`, `×`, `÷`, `±`, `%`, `MOD`, `xʸ`, `1/x`
- **Scientific functions**: `sin`, `cos`, `tan`, `sinh`, `cosh`, `tanh`, `log`, `ln`, `√`, `x²`, `x!`
- **Inverse & hyperbolic**: Toggle `INV` for inverse trig, `HYP` for hyperbolic
- **Constants**: `π`, `e`, `exp(x)`, `10ˣ`
- **Parentheses** with implicit multiplication (`2π`, `3(5+2)`)
- **Angle modes**: DEG / RAD / GRAD with indicator

### 💾 Memory & History
- **Memory**: `MC` / `MR` / `M+` / `M−` with memory indicator
- **History**: Last 50 calculations — click any entry to recall its result
- **ANS**: Last answer stored automatically

### ⌨️ Keyboard Shortcuts
| Key | Action |
|-----|--------|
| `0-9` | Digits |
| `.` | Decimal point |
| `+`, `-`, `*`, `/` | Operators |
| `Enter` / `=` | Evaluate |
| `Escape` | Clear all (AC) |
| `Backspace` | Delete last digit |
| `(` / `)` | Parentheses |
| `^` | Power (xʸ) |
| `%` | Modulo |
| `p` | Insert π |
| `e` | Insert e |
| `s`, `c`, `t` | sin, cos, tan |
| `l`, `n` | log, ln |
| `!` | Factorial |
| `r` | Random number |
| `Ctrl+Shift+P` | Toggle program sidebar |

### 💻 Programmable Scripting Engine

Write and run custom programs using the built-in interpreter:

```
// Fibonacci Sequence
let n = input('How many Fibonacci numbers? ');
let a = 0;
let b = 1;
print('Fibonacci sequence:');
for(let i = 0; i < n; i++) {
    print(a);
    let t = a + b;
    a = b;
    b = t;
}
```

**Language features:**
| Command | Description |
|---------|-------------|
| `let x = expr` | Variable assignment |
| `print(a, b, ...)` | Output to console |
| `input(prompt)` | User input (returns number or string) |
| `if(cond) { } elif { } else { }` | Conditionals |
| `while(cond) { }` | Loops (max 10k iterations) |
| `for(init; cond; incr) { }` | For-loops |
| `i++`, `i--`, `x += n` | Increment / compound assignment |
| `break` / `continue` | Loop control |
| `// comments` | Line comments |

**Built-in functions:** `sin`, `cos`, `tan`, `asin`, `acos`, `atan`, `sqrt`, `cbrt`, `log`, `ln`, `exp`, `abs`, `floor`, `ceil`, `round`, `max`, `min`, `pi`, `e`

### 📚 Library Examples
- **Fibonacci** — Generates the Fibonacci sequence
- **Quadratic Solver** — Solves `ax² + bx + c = 0` with real roots
- **Factorial** — Computes `n!` for non-negative integers
- **Prime Check** — Tests if a number is prime
- **Statistics** — Computes mean, median, standard deviation, min, max

### 🎨 Design
- Dark professional theme
- Responsive layout (mobile to desktop)
- Sidebar program editor with syntax coloring
- Persistent storage via `localStorage` (programs survive page refresh)

---

## 🚀 Getting Started

### Option 1: Use the live demo
Visit **[https://programmable-calculator-lj17ndtcy.vercel.app](https://programmable-calculator-lj17ndtcy.vercel.app)**

### Option 2: Run locally
```bash
git clone https://github.com/sajidhussainbaloch/Programmable-Calculator.git
cd Programmable-Calculator
# Open index.html in your browser — no server required
```

### Option 3: Deploy your own
The project is ready for Vercel, Netlify, or any static host:
```bash
vercel --prod
```

---

## 🛠️ Tech Stack
- **HTML5** — Semantic layout
- **CSS3** — Flexbox, Grid, custom properties, animations
- **Vanilla JavaScript** — No frameworks, no dependencies
- **Vercel** — Hosting & deployment

---

## 📄 License
MIT — free to use, modify, and distribute.
