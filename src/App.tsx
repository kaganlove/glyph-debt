import { useMemo, useState } from "react";
import "./App.css";

type GlyphType = "add" | "multiply" | "subtract" | "curse";

type Glyph = {
  id: string;
  label: string;
  type: GlyphType;
  value: number;
  description: string;
};

type BoardCell = Glyph | null;

type Contract =
  | {
      type: "exact";
      target: number;
      text: string;
    }
  | {
      type: "minimum";
      target: number;
      text: string;
    }
  | {
      type: "range";
      min: number;
      max: number;
      text: string;
    };

const glyphPool: Omit<Glyph, "id">[] = [
  {
    label: "+1",
    type: "add",
    value: 1,
    description: "Add 1 power.",
  },
  {
    label: "+2",
    type: "add",
    value: 2,
    description: "Add 2 power.",
  },
  {
    label: "+3",
    type: "add",
    value: 3,
    description: "Add 3 power.",
  },
  {
    label: "+5",
    type: "add",
    value: 5,
    description: "Add 5 power.",
  },
  {
    label: "x2",
    type: "multiply",
    value: 2,
    description: "Double the current power.",
  },
  {
    label: "x3",
    type: "multiply",
    value: 3,
    description: "Triple the current power.",
  },
  {
    label: "-1",
    type: "subtract",
    value: 1,
    description: "Subtract 1 power.",
  },
  {
    label: "C+6",
    type: "curse",
    value: 6,
    description: "Add 6 power, but gain 1 curse.",
  },
];

function createGlyph(): Glyph {
  const base = glyphPool[Math.floor(Math.random() * glyphPool.length)];

  return {
    ...base,
    id: crypto.randomUUID(),
  };
}

function createHand(size = 5): Glyph[] {
  return Array.from({ length: size }, createGlyph);
}

function createContract(): Contract {
  const roll = Math.random();

  if (roll < 0.4) {
    const target = randomInt(8, 24);

    return {
      type: "exact",
      target,
      text: `Create exactly ${target} power.`,
    };
  }

  if (roll < 0.75) {
    const target = randomInt(12, 30);

    return {
      type: "minimum",
      target,
      text: `Create at least ${target} power.`,
    };
  }

  const min = randomInt(8, 20);
  const max = min + randomInt(5, 10);

  return {
    type: "range",
    min,
    max,
    text: `Create between ${min} and ${max} power.`,
  };
}

function randomInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function calculatePower(placedGlyphs: Glyph[]) {
  let power = 0;
  let curse = 0;

  for (const glyph of placedGlyphs) {
    if (glyph.type === "add") {
      power += glyph.value;
    }

    if (glyph.type === "subtract") {
      power -= glyph.value;
    }

    if (glyph.type === "multiply") {
      power *= glyph.value;
    }

    if (glyph.type === "curse") {
      power += glyph.value;
      curse += 1;
    }
  }

  return { power, curse };
}

function checkContract(contract: Contract, power: number) {
  if (contract.type === "exact") {
    return power === contract.target;
  }

  if (contract.type === "minimum") {
    return power >= contract.target;
  }

  return power >= contract.min && power <= contract.max;
}

function App() {
  const [day, setDay] = useState(1);
  const [gold, setGold] = useState(0);
  const [debt, setDebt] = useState(30);
  const [contract, setContract] = useState<Contract>(() => createContract());
  const [hand, setHand] = useState<Glyph[]>(() => createHand());
  const [board, setBoard] = useState<BoardCell[]>(() => Array(16).fill(null));
  const [selectedGlyphId, setSelectedGlyphId] = useState<string | null>(null);
  const [message, setMessage] = useState("Choose a glyph, place it, then cast.");
  const [isRunOver, setIsRunOver] = useState(false);
  const [hasCast, setHasCast] = useState(false);

  const placedGlyphs = useMemo(() => {
    return board.filter((cell): cell is Glyph => cell !== null);
  }, [board]);

  const { power, curse } = useMemo(() => {
    return calculatePower(placedGlyphs);
  }, [placedGlyphs]);

  const selectedGlyph = hand.find((glyph) => glyph.id === selectedGlyphId);

  function placeGlyph(cellIndex: number) {
    if (hasCast) {
      setMessage("The spell has already been cast. Move to the next contract.");
      return;
    }

    if (!selectedGlyph || board[cellIndex]) return;

    const nextBoard = [...board];
    nextBoard[cellIndex] = selectedGlyph;

    setBoard(nextBoard);
    setHand((current) => current.filter((glyph) => glyph.id !== selectedGlyph.id));
    setSelectedGlyphId(null);
    setMessage(`${selectedGlyph.label} placed on the ritual board.`);
  }

  function castSpell() {
    if (hasCast) {
      setMessage("This contract has already been resolved.");
      return;
    }

    if (placedGlyphs.length === 0) {
      setMessage("You need to place at least one glyph first.");
      return;
    }

    const success = checkContract(contract, power);
    setHasCast(true);

    if (success) {
      const reward = Math.max(5, 10 + curse * 2);
      setGold((current) => current + reward);
      setMessage(`Contract fulfilled. You earned ${reward} gold.`);
      return;
    }

    setDebt((current) => current + 3);
    setMessage(`The ritual failed. Your spell created ${power} power. Debt increased by 3.`);
  }

  function nextContract() {
    if (!hasCast) {
      setMessage("Cast the spell before taking another contract.");
      return;
    }

    const nextDay = day + 1;

    if (nextDay % 3 === 1) {
      const debtAfterPayment = debt - gold;

      if (debtAfterPayment > 0) {
        setIsRunOver(true);
        return;
      }

      const newDebt = 30 + nextDay * 3;

      setDebt(newDebt);
      setGold(0);
      setMessage(`Debt paid. A new debt of ${newDebt} gold has been written in blood.`);
    } else {
      setMessage("A new contract slides across the counter.");
    }

    setDay(nextDay);
    setContract(createContract());
    setHand(createHand());
    setBoard(Array(16).fill(null));
    setSelectedGlyphId(null);
    setHasCast(false);
  }

  function restartRun() {
    setDay(1);
    setGold(0);
    setDebt(30);
    setContract(createContract());
    setHand(createHand());
    setBoard(Array(16).fill(null));
    setSelectedGlyphId(null);
    setMessage("Choose a glyph, place it, then cast.");
    setIsRunOver(false);
    setHasCast(false);
  }

  if (isRunOver) {
    return (
      <main className="app-shell">
        <section className="phone-frame center-content">
          <p className="eyebrow">Glyph Debt</p>
          <h1>The Collector has come.</h1>
          <p className="message">
            You survived {day} days before the debt swallowed the shop.
          </p>
          <button className="primary-button" onClick={restartRun}>
            Begin Again
          </button>
        </section>
      </main>
    );
  }

  return (
    <main className="app-shell">
      <section className="phone-frame">
        <header className="top-bar">
          <div>
            <span className="stat-label">Day</span>
            <strong>{day}</strong>
          </div>
          <div>
            <span className="stat-label">Gold</span>
            <strong>{gold}</strong>
          </div>
          <div>
            <span className="stat-label">Debt</span>
            <strong>{debt}</strong>
          </div>
        </header>

        <section className="contract-card">
          <p className="eyebrow">Current Contract</p>
          <h1>{contract.text}</h1>
          <p>
            Current spell: <strong>{power}</strong> power
            {curse > 0 ? `, ${curse} curse` : ""}
          </p>
        </section>

        <section className="board">
          {board.map((cell, index) => (
            <button
              key={index}
              className={`board-cell ${cell ? "filled" : ""}`}
              onClick={() => placeGlyph(index)}
            >
              {cell ? cell.label : ""}
            </button>
          ))}
        </section>

        <section className="hand">
          {hand.map((glyph) => (
            <button
              key={glyph.id}
              className={`glyph-card ${
                selectedGlyphId === glyph.id ? "selected" : ""
              }`}
              onClick={() => {
                if (hasCast) {
                  setMessage("The spell has already been cast. Move to the next contract.");
                  return;
                }

                setSelectedGlyphId(glyph.id);
                setMessage(glyph.description);
              }}
            >
              <strong>{glyph.label}</strong>
              <span>{glyph.description}</span>
            </button>
          ))}
        </section>

        <p className="message">{message}</p>

        <div className="action-row">
          <button className="secondary-button" onClick={restartRun}>
            Restart
          </button>
          <button
            className="primary-button"
            onClick={castSpell}
            disabled={hasCast}
          >
            Cast Spell
          </button>
          <button
            className="secondary-button"
            onClick={nextContract}
            disabled={!hasCast}
          >
            Next
          </button>
        </div>
      </section>
    </main>
  );
}

export default App;