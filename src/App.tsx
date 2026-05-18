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

type PlayerUpgrades = {
  rewardBonus: number;
  handSize: number;
  curseRewardBonus: number;
  failureProtection: number;
  contractEase: number;
};

type Upgrade = {
  id: string;
  title: string;
  description: string;
  apply: (current: PlayerUpgrades) => PlayerUpgrades;
};

const startingUpgrades: PlayerUpgrades = {
  rewardBonus: 0,
  handSize: 5,
  curseRewardBonus: 0,
  failureProtection: 0,
  contractEase: 0,
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

const upgradePool: Upgrade[] = [
  {
    id: "larger-hand",
    title: "Longer Fingers",
    description: "Draw 1 extra glyph each contract.",
    apply: (current) => ({
      ...current,
      handSize: current.handSize + 1,
    }),
  },
  {
    id: "gold-bonus",
    title: "Greedy Ink",
    description: "Earn 3 extra gold from every fulfilled contract.",
    apply: (current) => ({
      ...current,
      rewardBonus: current.rewardBonus + 3,
    }),
  },
  {
    id: "curse-payout",
    title: "Profitable Corruption",
    description: "Each curse is worth 2 more gold when a contract succeeds.",
    apply: (current) => ({
      ...current,
      curseRewardBonus: current.curseRewardBonus + 2,
    }),
  },
  {
    id: "failure-shield",
    title: "Cracked Ward",
    description: "Failed rituals add 1 less debt.",
    apply: (current) => ({
      ...current,
      failureProtection: current.failureProtection + 1,
    }),
  },
  {
    id: "easier-contracts",
    title: "Forged Fine Print",
    description: "Future contracts become slightly easier.",
    apply: (current) => ({
      ...current,
      contractEase: current.contractEase + 2,
    }),
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

function createRound(handSize = 5, ease = 0) {
  const hand = createHand(handSize);
  const possiblePowers = getPossiblePowers(hand);
  const contract = createContractFromPossiblePowers(possiblePowers, ease);

  return { hand, contract };
}

function getPossiblePowers(hand: Glyph[]) {
  const results = new Set<number>();

  function explore(remaining: Glyph[], sequence: Glyph[]) {
    if (sequence.length > 0) {
      const { power } = calculatePower(sequence);
      results.add(power);
    }

    for (let i = 0; i < remaining.length; i++) {
      const nextGlyph = remaining[i];
      const nextRemaining = remaining.filter((_, index) => index !== i);
      explore(nextRemaining, [...sequence, nextGlyph]);
    }
  }

  explore(hand, []);

  return Array.from(results)
    .filter((value) => value > 0)
    .sort((a, b) => a - b);
}

function createContractFromPossiblePowers(
  possiblePowers: number[],
  ease = 0
): Contract {
  const safePowers = possiblePowers.length > 0 ? possiblePowers : [5];
  const powerOptions = safePowers.filter((power) => power >= 1);
  const roll = Math.random();

  if (roll < 0.4) {
    const target = pickRandom(powerOptions);

    return {
      type: "exact",
      target,
      text: `Create exactly ${target} power.`,
    };
  }

  if (roll < 0.75) {
    const maxPower = Math.max(...powerOptions);
    const adjustedMax = Math.max(4, maxPower - ease);
    const lowTarget = Math.max(1, Math.floor(adjustedMax * 0.55));
    const target = randomInt(lowTarget, adjustedMax);

    return {
      type: "minimum",
      target,
      text: `Create at least ${target} power.`,
    };
  }

  const target = pickRandom(powerOptions);
  const spread = randomInt(2, 5) + ease;
  const min = Math.max(1, target - spread);
  const max = target + spread;

  return {
    type: "range",
    min,
    max,
    text: `Create between ${min} and ${max} power.`,
  };
}

function createUpgradeChoices(): Upgrade[] {
  const shuffled = [...upgradePool].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, 3);
}

function pickRandom<T>(items: T[]) {
  return items[Math.floor(Math.random() * items.length)];
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
  const [upgrades, setUpgrades] = useState<PlayerUpgrades>(startingUpgrades);

  const [startingRound] = useState(() => createRound(startingUpgrades.handSize));

  const [contract, setContract] = useState<Contract>(startingRound.contract);
  const [hand, setHand] = useState<Glyph[]>(startingRound.hand);
  const [board, setBoard] = useState<BoardCell[]>(() => Array(16).fill(null));
  const [selectedGlyphId, setSelectedGlyphId] = useState<string | null>(null);
  const [message, setMessage] = useState("Choose a glyph, place it, then cast.");
  const [isRunOver, setIsRunOver] = useState(false);
  const [hasCast, setHasCast] = useState(false);
  const [showUpgradeChoices, setShowUpgradeChoices] = useState(false);
  const [upgradeChoices, setUpgradeChoices] = useState<Upgrade[]>([]);

  const placedGlyphs = useMemo(() => {
    return board.filter((cell): cell is Glyph => cell !== null);
  }, [board]);

  const { power, curse } = useMemo(() => {
    return calculatePower(placedGlyphs);
  }, [placedGlyphs]);

  const selectedGlyph = hand.find((glyph) => glyph.id === selectedGlyphId);

  function startNewContract(
    nextDay: number,
    currentUpgrades: PlayerUpgrades,
    nextMessage: string
  ) {
    const nextRound = createRound(
      currentUpgrades.handSize,
      currentUpgrades.contractEase
    );

    setDay(nextDay);
    setContract(nextRound.contract);
    setHand(nextRound.hand);
    setBoard(Array(16).fill(null));
    setSelectedGlyphId(null);
    setHasCast(false);
    setMessage(nextMessage);
  }

  function placeGlyph(cellIndex: number) {
    if (hasCast) {
      setMessage("The spell has already been cast. Move to the next contract.");
      return;
    }

    if (!selectedGlyph || board[cellIndex]) return;

    const nextBoard = [...board];
    nextBoard[cellIndex] = selectedGlyph;

    setBoard(nextBoard);
    setHand((current) =>
      current.filter((glyph) => glyph.id !== selectedGlyph.id)
    );
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
      const reward = Math.max(
        5,
        10 + upgrades.rewardBonus + curse * (2 + upgrades.curseRewardBonus)
      );

      setGold((current) => current + reward);
      setMessage(`Contract fulfilled. You earned ${reward} gold.`);
      return;
    }

    const debtPenalty = Math.max(0, 3 - upgrades.failureProtection);
    setDebt((current) => current + debtPenalty);

    if (debtPenalty === 0) {
      setMessage("The ritual failed. Your ward absorbed the debt penalty.");
      return;
    }

    setMessage(
      `The ritual failed. Your spell created ${power} power. Debt increased by ${debtPenalty}.`
    );
  }

  function nextContract() {
    if (!hasCast) {
      setMessage("Cast the spell before taking another contract.");
      return;
    }

    if (day % 3 === 0) {
      if (gold < debt) {
        setIsRunOver(true);
        return;
      }

      const remainingGold = gold - debt;
      const newDebt = 30 + day * 4;

      setGold(remainingGold);
      setDebt(newDebt);
      setUpgradeChoices(createUpgradeChoices());
      setShowUpgradeChoices(true);
      setMessage("Debt paid. Choose a forbidden upgrade.");
      return;
    }

    startNewContract(day + 1, upgrades, "A new contract slides across the counter.");
  }

  function chooseUpgrade(upgrade: Upgrade) {
    const nextUpgrades = upgrade.apply(upgrades);

    setUpgrades(nextUpgrades);
    setShowUpgradeChoices(false);
    startNewContract(
      day + 1,
      nextUpgrades,
      `${upgrade.title} added. The next contract waits.`
    );
  }

  function restartRun() {
    const resetUpgrades = { ...startingUpgrades };
    const nextRound = createRound(resetUpgrades.handSize);

    setDay(1);
    setGold(0);
    setDebt(30);
    setUpgrades(resetUpgrades);
    setContract(nextRound.contract);
    setHand(nextRound.hand);
    setBoard(Array(16).fill(null));
    setSelectedGlyphId(null);
    setMessage("Choose a glyph, place it, then cast.");
    setIsRunOver(false);
    setHasCast(false);
    setShowUpgradeChoices(false);
    setUpgradeChoices([]);
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
                  setMessage(
                    "The spell has already been cast. Move to the next contract."
                  );
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
            disabled={hasCast || showUpgradeChoices}
          >
            Cast Spell
          </button>
          <button
            className="secondary-button"
            onClick={nextContract}
            disabled={!hasCast || showUpgradeChoices}
          >
            Next
          </button>
        </div>

        {showUpgradeChoices && (
          <section className="upgrade-overlay">
            <div className="upgrade-panel">
              <p className="eyebrow">Debt Paid</p>
              <h2>Choose a forbidden upgrade</h2>
              <div className="upgrade-list">
                {upgradeChoices.map((upgrade) => (
                  <button
                    key={upgrade.id}
                    className="upgrade-card"
                    onClick={() => chooseUpgrade(upgrade)}
                  >
                    <strong>{upgrade.title}</strong>
                    <span>{upgrade.description}</span>
                  </button>
                ))}
              </div>
            </div>
          </section>
        )}
      </section>
    </main>
  );
}

export default App;