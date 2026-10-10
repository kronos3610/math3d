import { calculateBayes } from '../../utils/bayes';
import type { BayesParameters, BayesResult } from '../../utils/bayes';

export type BayesView = 'population' | 'flags' | 'conditional';
export type BayesOrientation = 'horizontal' | 'vertical';
export type Position3 = [number, number, number];

export interface BayesPopulationPiece {
    sourceSlot: number;
    event: boolean;
    flagged: boolean;
    /** Exact expected email count represented by this piece, without rounding. */
    weight: number;
    /** Fraction of one nominal source tile occupied by this piece. */
    fraction: number;
    position: Position3;
    scale: Position3;
}

export interface BayesBoard {
    position: Position3;
    width: number;
    height: number;
    labelPosition: Position3;
}

export interface BayesPopulationLayout {
    pieces: BayesPopulationPiece[];
    result: BayesResult;
    sourceBoard: BayesBoard;
    selectedBoard: BayesBoard | null;
    nominalTileWeight: number;
    bounds: { minimum: Position3; maximum: Position3 };
}

const NOMINAL_TILES = 1000;
const SOURCE_COLUMNS = 40;
const SOURCE_PITCH = 0.5;
const TILE_EDGE = 0.42;
const SELECTED_SCALE = 1.3;
const GAP = 3;

interface WeightInterval { start: number; end: number; event: boolean; flagged: boolean; }

function board(position: Position3, width: number, height: number): BayesBoard {
    return { position, width, height, labelPosition: [position[0], position[1] + height / 2 + 0.85, 0.1] };
}

/**
 * A fixed number of slots keeps GPU cost bounded. At population=1000 each full
 * tile represents one email. Category/selection boundaries split a slot into
 * weighted strips; their widths preserve all expected counts, including fractions.
 */
export function createBayesPopulationLayout(
    parameters: BayesParameters,
    view: BayesView,
    orientation: BayesOrientation = 'horizontal',
): BayesPopulationLayout {
    const result = calculateBayes(parameters);
    const population = parameters.population ?? 1000;
    const nominalTileWeight = population / NOMINAL_TILES;
    const intervals: WeightInterval[] = [
        { start: 0, end: result.eventAndEvidenceCount, event: true, flagged: true },
        { start: result.eventAndEvidenceCount, end: result.eventCount, event: true, flagged: false },
        { start: result.eventCount, end: result.eventCount + result.nonEventAndEvidenceCount, event: false, flagged: true },
        { start: result.eventCount + result.nonEventAndEvidenceCount, end: population, event: false, flagged: false },
    ];
    const pieces: Array<Omit<BayesPopulationPiece, 'position' | 'scale'> & { sourceOffset: number }> = [];
    for (let slot = 0; slot < NOMINAL_TILES; slot++) {
        const slotStart = slot * nominalTileWeight;
        const slotEnd = slot === NOMINAL_TILES - 1 ? population : (slot + 1) * nominalTileWeight;
        for (const interval of intervals) {
            const start = Math.max(slotStart, interval.start);
            const end = Math.min(slotEnd, interval.end);
            if (end <= start) continue;
            const weight = end - start;
            pieces.push({
                sourceSlot: slot,
                event: interval.event,
                flagged: interval.flagged,
                weight,
                fraction: weight / nominalTileWeight,
                sourceOffset: (start - slotStart) / nominalTileWeight,
            });
        }
    }

    const selectedPieceCount = pieces.reduce((sum, piece) => sum + Number(piece.flagged), 0);
    const selectedColumns = Math.max(1, Math.ceil(Math.sqrt(selectedPieceCount * 1.6)));
    const selectedRows = Math.max(1, Math.ceil(selectedPieceCount / selectedColumns));
    const sourceWidth = SOURCE_COLUMNS * SOURCE_PITCH;
    const sourceHeight = (NOMINAL_TILES / SOURCE_COLUMNS) * SOURCE_PITCH;
    const selectedPitch = SOURCE_PITCH * SELECTED_SCALE;
    const selectedWidth = selectedColumns * selectedPitch;
    const selectedHeight = selectedRows * selectedPitch;
    const hasSelectedBoard = view === 'conditional' && selectedPieceCount > 0;
    let sourcePosition: Position3 = [0, 0, 0];
    let selectedPosition: Position3 = [0, 0, 0];
    if (hasSelectedBoard) {
        if (orientation === 'horizontal') {
            const width = sourceWidth + GAP + selectedWidth;
            sourcePosition = [-width / 2 + sourceWidth / 2, 0, 0];
            selectedPosition = [width / 2 - selectedWidth / 2, 0, 0];
        } else {
            const height = sourceHeight + GAP + selectedHeight;
            sourcePosition = [0, height / 2 - sourceHeight / 2, 0];
            selectedPosition = [0, -height / 2 + selectedHeight / 2, 0];
        }
    }
    const sourceBoard = board(sourcePosition, sourceWidth, sourceHeight);
    const selectedBoard = hasSelectedBoard ? board(selectedPosition, selectedWidth, selectedHeight) : null;
    let selectedIndex = 0;
    const positionedPieces = pieces.map(piece => {
        const selected = view === 'conditional' && piece.flagged;
        const magnification = selected ? SELECTED_SCALE : view === 'flags' && piece.flagged ? 1.06 : 1;
        let position: Position3;
        if (selected) {
            position = [
                selectedPosition[0] + (selectedIndex % selectedColumns - (selectedColumns - 1) / 2) * selectedPitch + (piece.fraction / 2 - 0.5) * TILE_EDGE * magnification,
                selectedPosition[1] + ((selectedRows - 1) / 2 - Math.floor(selectedIndex / selectedColumns)) * selectedPitch,
                0.35,
            ];
            selectedIndex++;
        } else {
            position = [
                sourcePosition[0] + (piece.sourceSlot % SOURCE_COLUMNS - (SOURCE_COLUMNS - 1) / 2) * SOURCE_PITCH + (piece.sourceOffset + piece.fraction / 2 - 0.5) * TILE_EDGE,
                sourcePosition[1] + ((NOMINAL_TILES / SOURCE_COLUMNS - 1) / 2 - Math.floor(piece.sourceSlot / SOURCE_COLUMNS)) * SOURCE_PITCH,
                view === 'flags' && piece.flagged ? 1.1 : 0,
            ];
        }
        return {
            sourceSlot: piece.sourceSlot,
            event: piece.event,
            flagged: piece.flagged,
            weight: piece.weight,
            fraction: piece.fraction,
            position,
            scale: [TILE_EDGE * piece.fraction * magnification, TILE_EDGE * magnification, 0.12] as Position3,
        };
    });
    const boards = selectedBoard ? [sourceBoard, selectedBoard] : [sourceBoard];
    return {
        pieces: positionedPieces,
        result,
        sourceBoard,
        selectedBoard,
        nominalTileWeight,
        bounds: {
            minimum: [Math.min(...boards.map(item => item.position[0] - item.width / 2)) - 0.6,
                Math.min(...boards.map(item => item.position[1] - item.height / 2)) - 0.6, -0.2],
            maximum: [Math.max(...boards.map(item => item.position[0] + item.width / 2)) + 0.6,
                Math.max(...boards.map(item => item.labelPosition[1])) + 0.6, 1.3],
        },
    };
}
