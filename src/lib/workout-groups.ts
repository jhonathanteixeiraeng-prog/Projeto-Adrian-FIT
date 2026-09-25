/**
 * Supersets: consecutive exercises of a workout day that share a `groupId` (bi-set, tri-set, circuit).
 * They are done in rounds — A1 set 1 → A2 set 1 → rest → A1 set 2 → A2 set 2 → rest … — with rest only
 * after the last exercise of each round, and every exercise of a group has the same number of sets.
 */

export interface GroupableItem {
    groupId?: string | null;
    sets: number;
}

export interface GroupIssue {
    index: number;
    message: string;
}

export interface GroupInfo {
    groupId: string;
    /** "A", "B"… in the order groups appear in the day. */
    letter: string;
    /** 1-based position inside the group (A1, A2…). */
    position: number;
    size: number;
    label: string;
    isFirst: boolean;
    isLast: boolean;
}

export interface SessionStep {
    itemIndex: number;
    setIndex: number;
    /** False for every exercise of a group except the last one of the round. */
    restAfter: boolean;
}

/** "Bi-set" (2), "Tri-set" (3) or "Circuito" (4+). */
export function groupLabel(size: number): string {
    if (size >= 4) return 'Circuito';
    if (size === 3) return 'Tri-set';
    return 'Bi-set';
}

const cleanId = (value: string | null | undefined) => (typeof value === 'string' ? value.trim() : '');

/** Positions of each group id, in item order. */
function groupPositions(items: GroupableItem[]): Map<string, number[]> {
    const positions = new Map<string, number[]>();
    items.forEach((item, index) => {
        const id = cleanId(item.groupId);
        if (!id) return;
        const list = positions.get(id) ?? [];
        list.push(index);
        positions.set(id, list);
    });
    return positions;
}

const isContiguous = (indexes: number[]) => indexes.every((value, i) => i === 0 || value === indexes[i - 1] + 1);

/** Problems with the groups of a day. Single-member groups are not errors (they are simply ungrouped). */
export function findGroupIssues(items: GroupableItem[]): GroupIssue[] {
    const issues: GroupIssue[] = [];
    groupPositions(items).forEach((indexes) => {
        if (indexes.length < 2) return;
        const label = groupLabel(indexes.length);
        if (!isContiguous(indexes)) {
            const broken = indexes.find((value, i) => i > 0 && value !== indexes[i - 1] + 1) ?? indexes[1];
            issues.push({ index: broken, message: `${label}: os exercícios do grupo precisam ficar em sequência` });
        }
        const sets = items[indexes[0]].sets;
        const different = indexes.find((index) => items[index].sets !== sets);
        if (different !== undefined) {
            issues.push({ index: different, message: `${label}: os exercícios do grupo precisam ter o mesmo número de séries` });
        }
    });
    return issues;
}

/**
 * Returns the group id each item should keep: single-member groups always become null, and so do groups
 * that are split apart or have different set counts when `repairInvalid` is set (saves from app versions
 * that don't know about groups must never be rejected because of them).
 */
export function normalizedGroupIds(items: GroupableItem[], options: { repairInvalid?: boolean } = {}): Array<string | null> {
    const result = items.map((item) => cleanId(item.groupId) || null);
    groupPositions(items).forEach((indexes) => {
        const invalid =
            indexes.length < 2 ||
            (options.repairInvalid && (!isContiguous(indexes) || indexes.some((index) => items[index].sets !== items[indexes[0]].sets)));
        if (invalid) indexes.forEach((index) => (result[index] = null));
    });
    return result;
}

/** Display info per item (null when the item isn't in a group). Assumes valid, contiguous groups. */
export function describeGroups(items: GroupableItem[]): Array<GroupInfo | null> {
    const ids = normalizedGroupIds(items);
    const positions = new Map<string, number[]>();
    ids.forEach((id, index) => {
        if (!id) return;
        const list = positions.get(id) ?? [];
        list.push(index);
        positions.set(id, list);
    });
    const letters = new Map<string, string>();
    Array.from(positions.keys()).forEach((id, groupIndex) => letters.set(id, String.fromCharCode(65 + (groupIndex % 26))));

    return ids.map((id, index) => {
        if (!id) return null;
        const members = positions.get(id)!;
        const position = members.indexOf(index);
        return {
            groupId: id,
            letter: letters.get(id)!,
            position: position + 1,
            size: members.length,
            label: groupLabel(members.length),
            isFirst: position === 0,
            isLast: position === members.length - 1,
        };
    });
}

/**
 * Order in which the sets of a day are done: ungrouped exercises set by set, groups round by round
 * (A1s1, A2s1, A1s2, A2s2…). Rest happens after ungrouped sets and after the last exercise of each round.
 */
export function sessionSequence(items: GroupableItem[]): SessionStep[] {
    const info = describeGroups(items);
    const steps: SessionStep[] = [];
    let index = 0;
    while (index < items.length) {
        const group = info[index];
        if (!group) {
            for (let set = 0; set < Math.max(0, items[index].sets); set++) steps.push({ itemIndex: index, setIndex: set, restAfter: true });
            index++;
            continue;
        }
        const members = Array.from({ length: group.size }, (_, i) => index + i);
        const rounds = Math.max(...members.map((member) => Math.max(0, items[member].sets)));
        for (let set = 0; set < rounds; set++) {
            const inRound = members.filter((member) => set < items[member].sets);
            inRound.forEach((member, i) => steps.push({ itemIndex: member, setIndex: set, restAfter: i === inRound.length - 1 }));
        }
        index += group.size;
    }
    return steps;
}
