import { useMemo, useState } from "react";
import "./App.css";

type GlyphType =
  | "add"
  | "subtract"
  | "curse"
  | "edgeDouble"
  | "cornerAdd"
  | "centerAdd"
  | "copyLeft"
  | "neighborAdd";

type Glyph = {
  id: string;
  label: string;
  shortLabel: string;
  type: GlyphType;
  value: number;
  description: string;
  isSpecial?: boolean;
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

type SpellResult = {
  power: number;
  curse: number;
  multiplier: number;
};

const BOARD_SIZE = 16;
const BOARD_WIDTH = 4;
const STARTING_DEBT = 24;
const BASE_REWARD = 12;

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
    shortLabel: "+1",
    type: "add",
    value: 1,
    description: "Add 1 power.",
  },
  {
    label: "+2",
    shortLabel: "+2",
    type: "add",
    value: 2,
    description: "Add 2 power.",
  },
  {
    label: "+3",
    shortLabel: "+3",
    type: "add",
    value: 3,
    description: "Add 3 power.",
  },
  {
    label: "+5",
    shortLabel: "+5",
    type: "add",
    value: 5,
    description: "Add 5 power.",
  },
  {
    label: "-1",
    shortLabel: "-1",
    type: "subtract",
    value: 1,
    description: "Subtract 1 power.",
  },
  {
    label: "Cursed +6",
    shortLabel: "C+6",
    type: "curse",
    value: 6,
    description: "Add 6 power and 1 curse. Curses increase payout.",
  },
  {
    label: "Edge x2",
    shortLabel: "Ex2",
    type: "edgeDouble",
    value: 2,
    description: "Double the spell if placed on an outer edge.",
    isSpecial: true,
  },
  {
    label: "Corner +7",
    shortLabel: "Co+7",
    type: "cornerAdd",
    value: 7,
    description: "Add 7 power in a corner. Otherwise add 2.",
    isSpecial: true,
  },
  {
    label: "Center +6",
    shortLabel: "Ce+6",
    type: "centerAdd",
    value: 6,
    description: "Add 6 power in the center. Otherwise add 1.",
    isSpecial: true,
  },
  {
    label: "Copy Left",
    shortLabel: "Copy",
    type: "copyLeft",
    value: 0,
    description: "Copy the base power of the glyph directly to the left.",
    isSpecial: true,
  },
  {
    label: "Neighbor +2",
    shortLabel: "N+2",
    type: "neighborAdd",
    value: 2,
    description: "Add 2 power for each adjacent glyph.",
    isSpecial: true,
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

function createGlyphFromBase(base: Omit<Glyph, "id">): Glyph {
  return {
    ...base,
    id: crypto.randomUUID(),
  };
}

function createHand(size = 5): Glyph[] {
  const basics = glyphPool.filter((glyph) => !glyph.isSpecial);
  const specials = shuffleArray(glyphPool.filter((glyph) => glyph.isSpecial));
  const hand: Glyph[] = [];

  const specialCount = Math.min(randomInt(1, 2), size, specials.length);

  for (let i = 0; i < specialCount; i++) {
    hand.push(createGlyphFromBase(specials[i]));
  }

  while (hand.length < size) {
    const base = basics[Math.floor(Math.random() * basics.length)];
    hand.push(createGlyphFromBase(base));
  }

  return shuffleArray(hand);
}

function createRound(handSize = 5, ease = 0) {
  const hand = createHand(handSize);
  const solutionBoard = createRandomSolutionBoard(hand);
  const solutionPower = calculateSpell(solutionBoard).power;
  const contract = createContractFromSolution(solutionPower, ease);

  return { hand, contract };
}

function createRandomSolutionBoard(hand: Glyph[]) {
  for (let attempt = 0; attempt < 200; attempt++) {
    const board: BoardCell[] = Array(BOARD_SIZE).fill(null);
    const shuffledHand = shuffleArray(hand);
    const glyphCount = randomInt(2, Math.min(hand.length, 5));
    const solutionGlyphs = shuffledHand.slice(0, glyphCount);
    const positions = shuffleArray(
      Array.from({ length: BOARD_SIZE }, (_, index) => index)
    ).slice(0, glyphCount);

    solutionGlyphs.forEach((glyph, index) => {
      board[positions[index]] = glyph;
    });

    const result = calculateSpell(board);

    if (result.power > 0) {
      return board;
    }
  }

  const fallbackBoard: BoardCell[] = Array(BOARD_SIZE).fill(null);

  hand.slice(0, 3).forEach((glyph, index) => {
    fallbackBoard[index] = glyph;
  });

  return fallbackBoard;
}

function createContractFromSolution(solutionPower: number, ease = 0): Contract {
  const safePower = Math.max(1, solutionPower);
  const roll = Math.random();

  if (roll < 0.4) {
    return {
      type: "exact",
      target: safePower,
      text: `Create exactly ${safePower} power.`,
    };
  }

  if (roll < 0.75) {
    const lowTarget = Math.max(1, Math.floor(safePower * 0.65));
    const highTarget = Math.max(1, safePower - ease);
    const target = randomInt(lowTarget, Math.max(lowTarget, highTarget));

    return {
      type: "minimum",
      target,
      text: `Create at least ${target} power.`,
    };
  }

  const spread = randomInt(2, 5) + ease;
  const min = Math.max(1, safePower - spread);
  const max = safePower + spread;

  return {
    type: "range",
    min,
    max,
    text: `Create between ${min} and ${max} power.`,
  };
}

function createUpgradeChoices(): Upgrade[] {
  return shuffleArray(upgradePool).slice(0, 3);
}

function calculateSpell(board: BoardCell[]): SpellResult {
  const baseValues = board.map((glyph, index) => {
    if (!glyph) return 0;

    if (glyph.type === "add") {
      return glyph.value;
    }

    if (glyph.type === "subtract") {
      return -glyph.value;
    }

    if (glyph.type === "curse") {
      return glyph.value;
    }

    if (glyph.type === "cornerAdd") {
      return isCorner(index) ? 7 : 2;
    }

    if (glyph.type === "centerAdd") {
      return isCenter(index) ? 6 : 1;
    }

    if (glyph.type === "neighborAdd") {
      return (
        getAdjacentIndexes(index).filter((adjacentIndex) => {
          return board[adjacentIndex] !== null;
        }).length * glyph.value
      );
    }

    return 0;
  });

  let basePower = baseValues.reduce((total, value) => total + value, 0);
  let curse = 0;
  let multiplier = 1;

  board.forEach((glyph, index) => {
    if (!glyph) return;

    if (glyph.type === "curse") {
      curse += 1;
    }

    if (glyph.type === "edgeDouble" && isEdge(index)) {
      multiplier *= 2;
    }

    if (glyph.type === "copyLeft") {
      const leftIndex = getLeftIndex(index);

      if (leftIndex !== null) {
        basePower += baseValues[leftIndex];
      }
    }
  });

  return {
    power: Math.max(0, basePower * multiplier),
    curse,
    multiplier,
  };
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

function getContractPreviewText(contract: Contract, power: number) {
  if (checkContract(contract, power)) {
    return "This would fulfill the contract.";
  }

  if (contract.type === "exact") {
    if (power < contract.target) {
      return `Still short by ${contract.target - power} power.`;
    }

    return `Too high by ${power - contract.target} power.`;
  }

  if (contract.type === "minimum") {
    return `Still short by ${contract.target - power} power.`;
  }

  if (power < contract.min) {
    return `Still short by ${contract.min - power} power.`;
  }

  return `Too high by ${power - contract.max} power.`;
}

function calculateNextDebt(day: number) {
  const cycle = Math.floor(day / 3);
  return 24 + cycle * 8;
}

function getContractsUntilDebtDue(day: number) {
  return 3 - ((day - 1) % 3);
}

function isDebtDueAfterThisContract(day: number) {
  return day % 3 === 0;
}

function calculateProjectedReward(curse: number, upgrades: PlayerUpgrades) {
  const curseBonus = curse * (2 + upgrades.curseRewardBonus);

  return {
    baseReward: BASE_REWARD,
    upgradeBonus: upgrades.rewardBonus,
    curseBonus,
    totalReward: Math.max(5, BASE_REWARD + upgrades.rewardBonus + curseBonus),
  };
}

function isEdge(index: number) {
  const row = Math.floor(index / BOARD_WIDTH);
  const column = index % BOARD_WIDTH;

  return row === 0 || row === 3 || column === 0 || column === 3;
}

function isCorner(index: number) {
  return index === 0 || index === 3 || index === 12 || index === 15;
}

function isCenter(index: number) {
  return index === 5 || index === 6 || index === 9 || index === 10;
}

function getLeftIndex(index: number) {
  const column = index % BOARD_WIDTH;

  if (column === 0) {
    return null;
  }

  return index - 1;
}

function getAdjacentIndexes(index: number) {
  const row = Math.floor(index / BOARD_WIDTH);
  const column = index % BOARD_WIDTH;
  const adjacentIndexes: number[] = [];

  if (row > 0) {
    adjacentIndexes.push(index - BOARD_WIDTH);
  }

  if (row < BOARD_WIDTH - 1) {
    adjacentIndexes.push(index + BOARD_WIDTH);
  }

  if (column > 0) {
    adjacentIndexes.push(index - 1);
  }

  if (column < BOARD_WIDTH - 1) {
    adjacentIndexes.push(index + 1);
  }

  return adjacentIndexes;
}

function shuffleArray<T>(items: T[]) {
  return [...items].sort(() => Math.random() - 0.5);
}

function randomInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function App() {
  const [day, setDay] = useState(1);
  const [gold, setGold] = useState(0);
  const [debt, setDebt] = useState(STARTING_DEBT);
  const [upgrades, setUpgrades] = useState<PlayerUpgrades>(startingUpgrades);

  const [startingRound] = useState(() => createRound(startingUpgrades.handSize));

  const [contract, setContract] = useState<Contract>(startingRound.contract);
  const [hand, setHand] = useState<Glyph[]>(startingRound.hand);
  const [board, setBoard] = useState<BoardCell[]>(() =>
    Array(BOARD_SIZE).fill(null)
  );
  const [selectedGlyphId, setSelectedGlyphId] = useState<string | null>(null);
  const [draggedGlyphId, setDraggedGlyphId] = useState<string | null>(null);
  const [previewCellIndex, setPreviewCellIndex] = useState<number | null>(null);
  const [message, setMessage] = useState(
    "Choose a glyph, place it, then cast."
  );
  const [isRunOver, setIsRunOver] = useState(false);
  const [hasCast, setHasCast] = useState(false);
  const [showUpgradeChoices, setShowUpgradeChoices] = useState(false);
  const [upgradeChoices, setUpgradeChoices] = useState<Upgrade[]>([]);

  const selectedGlyph = hand.find((glyph) => glyph.id === selectedGlyphId);

  const previewBoard = useMemo(() => {
    if (!selectedGlyph || previewCellIndex === null || board[previewCellIndex]) {
      return null;
    }

    const nextBoard = [...board];
    nextBoard[previewCellIndex] = selectedGlyph;
    return nextBoard;
  }, [board, previewCellIndex, selectedGlyph]);

  const { power, curse, multiplier } = useMemo(() => {
    return calculateSpell(board);
  }, [board]);

  const previewResult = useMemo(() => {
    if (!previewBoard) return null;
    return calculateSpell(previewBoard);
  }, [previewBoard]);

  const projectedReward = useMemo(() => {
    return calculateProjectedReward(curse, upgrades);
  }, [curse, upgrades]);

  const contractsUntilDebtDue = getContractsUntilDebtDue(day);
  const shortfall = Math.max(0, debt - gold);
  const projectedGoldAfterSuccess = gold + projectedReward.totalReward;
  const projectedShortfallAfterSuccess = Math.max(
    0,
    debt - projectedGoldAfterSuccess
  );

  const debtStatus = shortfall === 0 ? "Safe" : `Short by ${shortfall}`;

  const projectedDebtStatus =
    projectedShortfallAfterSuccess === 0
      ? "Success makes you safe."
      : `After success, still short by ${projectedShortfallAfterSuccess}.`;

  const previewText = previewResult
    ? getContractPreviewText(contract, previewResult.power)
    : "";

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
    setBoard(Array(BOARD_SIZE).fill(null));
    setSelectedGlyphId(null);
    setDraggedGlyphId(null);
    setPreviewCellIndex(null);
    setHasCast(false);
    setMessage(nextMessage);
  }

  function placeGlyph(cellIndex: number, glyphId?: string) {
    if (hasCast) {
      setMessage("The spell has already been cast. Move to the next contract.");
      return;
    }

    const glyphToPlace =
      hand.find((glyph) => glyph.id === glyphId) || selectedGlyph;

    if (!glyphToPlace || board[cellIndex]) return;

    const nextBoard = [...board];
    nextBoard[cellIndex] = glyphToPlace;

    setBoard(nextBoard);
    setHand((current) =>
      current.filter((glyph) => glyph.id !== glyphToPlace.id)
    );
    setSelectedGlyphId(null);
    setDraggedGlyphId(null);
    setPreviewCellIndex(null);
    setPlacementMessage(glyphToPlace, cellIndex);
  }

  function previewOrPlaceGlyph(cellIndex: number) {
    if (!selectedGlyph || board[cellIndex]) {
      placeGlyph(cellIndex);
      return;
    }

    if (previewCellIndex !== cellIndex) {
      const nextBoard = [...board];
      nextBoard[cellIndex] = selectedGlyph;
      const preview = calculateSpell(nextBoard);
      setPreviewCellIndex(cellIndex);
      setMessage(
        `Preview: placing ${selectedGlyph.label} here creates ${preview.power} power. ${getContractPreviewText(
          contract,
          preview.power
        )}`
      );
      return;
    }

    placeGlyph(cellIndex);
  }

  function removeGlyphFromBoard(cellIndex: number) {
    if (hasCast) {
      setMessage("The spell has already been cast. Move to the next contract.");
      return;
    }

    const glyph = board[cellIndex];

    if (!glyph) return;

    const nextBoard = [...board];
    nextBoard[cellIndex] = null;

    setBoard(nextBoard);
    setHand((current) => [...current, glyph]);
    setSelectedGlyphId(null);
    setDraggedGlyphId(null);
    setPreviewCellIndex(null);
    setMessage(`${glyph.label} returned to your hand.`);
  }

  function clearBoard() {
    if (hasCast) {
      setMessage("The spell has already been cast. Move to the next contract.");
      return;
    }

    const placedGlyphs = board.filter((cell): cell is Glyph => cell !== null);

    if (placedGlyphs.length === 0) {
      setMessage("The ritual board is already empty.");
      return;
    }

    setHand((current) => [...current, ...placedGlyphs]);
    setBoard(Array(BOARD_SIZE).fill(null));
    setSelectedGlyphId(null);
    setDraggedGlyphId(null);
    setPreviewCellIndex(null);
    setMessage("The ritual board has been cleared.");
  }

  function setPlacementMessage(glyph: Glyph, cellIndex: number) {
    if (glyph.type === "edgeDouble") {
      setMessage(
        isEdge(cellIndex)
          ? "Edge x2 placed on an edge. The spell will double."
          : "Edge x2 placed away from the edge. It has no effect here."
      );
      return;
    }

    if (glyph.type === "cornerAdd") {
      setMessage(
        isCorner(cellIndex)
          ? "Corner +7 placed in a corner. Full power gained."
          : "Corner +7 placed outside a corner. It only adds 2 here."
      );
      return;
    }

    if (glyph.type === "centerAdd") {
      setMessage(
        isCenter(cellIndex)
          ? "Center +6 placed in the center. Full power gained."
          : "Center +6 placed outside the center. It only adds 1 here."
      );
      return;
    }

    if (glyph.type === "copyLeft") {
      setMessage(
        getLeftIndex(cellIndex) !== null
          ? "Copy Left placed. It will copy the base power to its left."
          : "Copy Left placed on the far left. There is nothing to copy."
      );
      return;
    }

    if (glyph.type === "neighborAdd") {
      setMessage("Neighbor +2 placed. It grows stronger beside other glyphs.");
      return;
    }

    if (glyph.type === "curse") {
      setMessage("Cursed +6 placed. More power now. More profit if it works.");
      return;
    }

    setMessage(`${glyph.label} placed on the ritual board.`);
  }

  function castSpell() {
    if (hasCast) {
      setMessage("This contract has already been resolved.");
      return;
    }

    const placedGlyphs = board.filter((cell) => cell !== null);

    if (placedGlyphs.length === 0) {
      setMessage("You need to place at least one glyph first.");
      return;
    }

    const success = checkContract(contract, power);
    setHasCast(true);

    if (success) {
      const reward = projectedReward.totalReward;

      setGold((current) => current + reward);
      setMessage(
        `Contract fulfilled. Gold: ${projectedReward.baseReward} base + ${projectedReward.upgradeBonus} upgrade + ${projectedReward.curseBonus} curse = ${reward}.`
      );
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

    if (isDebtDueAfterThisContract(day)) {
      if (gold < debt) {
        setIsRunOver(true);
        return;
      }

      const remainingGold = gold - debt;
      const newDebt = calculateNextDebt(day);

      setGold(remainingGold);
      setDebt(newDebt);
      setUpgradeChoices(createUpgradeChoices());
      setShowUpgradeChoices(true);
      setMessage(
        `Debt paid. ${remainingGold} gold remains. New debt: ${newDebt}. Choose a forbidden upgrade.`
      );
      return;
    }

    startNewContract(
      day + 1,
      upgrades,
      "A new contract slides across the counter."
    );
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
    setDebt(STARTING_DEBT);
    setUpgrades(resetUpgrades);
    setContract(nextRound.contract);
    setHand(nextRound.hand);
    setBoard(Array(BOARD_SIZE).fill(null));
    setSelectedGlyphId(null);
    setDraggedGlyphId(null);
    setPreviewCellIndex(null);
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
            {multiplier > 1 ? `, x${multiplier} multiplier` : ""}
          </p>
          {previewResult && (
            <p className="preview-line">
              Preview: <strong>{previewResult.power}</strong> power.{" "}
              {previewText}
            </p>
          )}
        </section>

        <section className="cycle-card compact-cycle-card">
          <div className="cycle-row">
            <span>Debt</span>
            <strong>
              {contractsUntilDebtDue === 1
                ? "Due after this contract"
                : `Due in ${contractsUntilDebtDue}`}
            </strong>
          </div>

          <div className="cycle-row">
            <span>Status</span>
            <strong>{debtStatus}</strong>
          </div>

          <div className="cycle-row">
            <span>Success</span>
            <strong>+{projectedReward.totalReward} gold</strong>
          </div>

          <div className="cycle-note">{projectedDebtStatus}</div>
        </section>

        <section className="board">
          {board.map((cell, index) => (
            <button
              key={index}
              className={`board-cell ${cell ? "filled" : ""} ${
                previewCellIndex === index ? "previewed" : ""
              }`}
              onClick={() => {
                if (cell) {
                  removeGlyphFromBoard(index);
                  return;
                }

                previewOrPlaceGlyph(index);
              }}
              onMouseEnter={() => {
                if (!selectedGlyph || board[index] || hasCast) return;
                setPreviewCellIndex(index);
              }}
              onMouseLeave={() => {
                if (!selectedGlyph || hasCast) return;
                setPreviewCellIndex(null);
              }}
              onDragOver={(event) => {
                event.preventDefault();
              }}
              onDrop={(event) => {
                event.preventDefault();
                const glyphId =
                  event.dataTransfer.getData("text/plain") || draggedGlyphId;

                if (glyphId) {
                  placeGlyph(index, glyphId);
                }
              }}
            >
              {cell
                ? cell.shortLabel
                : previewCellIndex === index && selectedGlyph
                  ? selectedGlyph.shortLabel
                  : ""}
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
              draggable={!hasCast}
              onDragStart={(event) => {
                if (hasCast) return;

                setDraggedGlyphId(glyph.id);
                event.dataTransfer.setData("text/plain", glyph.id);
                event.dataTransfer.effectAllowed = "move";
              }}
              onDragEnd={() => {
                setDraggedGlyphId(null);
              }}
              onClick={() => {
                if (hasCast) {
                  setMessage(
                    "The spell has already been cast. Move to the next contract."
                  );
                  return;
                }

                setSelectedGlyphId(glyph.id);
                setPreviewCellIndex(null);
                setMessage(
                  `${glyph.description} Tap an empty cell once to preview, then tap it again to place.`
                );
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

        <div className="utility-row">
          <button
            className="secondary-button"
            onClick={clearBoard}
            disabled={hasCast || showUpgradeChoices}
          >
            Clear Board
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