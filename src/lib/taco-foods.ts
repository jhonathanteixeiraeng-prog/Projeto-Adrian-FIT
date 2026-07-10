// Base de alimentos saudáveis para geração automática de dietas.
// Valores nutricionais por 100g baseados na TACO (Tabela Brasileira de
// Composição de Alimentos - Unicamp), com arredondamentos práticos.
// Porções em medidas caseiras para o aluno não precisar de balança.

export type FoodGroup =
    | 'ovo'
    | 'laticinio'
    | 'ave'
    | 'carne'
    | 'porco'
    | 'peixe'
    | 'suplemento'
    | 'arroz'
    | 'feijao'
    | 'leguminosa'
    | 'tuberculo'
    | 'massa'
    | 'pao'
    | 'cereal'
    | 'tapioca'
    | 'fruta'
    | 'legume'
    | 'folhoso'
    | 'oleaginosa'
    | 'azeite';

export type RestrictionTag =
    | 'lactose'
    | 'gluten'
    | 'ovo'
    | 'carne'
    | 'carne-vermelha'
    | 'porco'
    | 'peixe'
    | 'oleaginosa';

export interface TacoFood {
    id: string;
    name: string;
    group: FoodGroup;
    tags: RestrictionTag[];
    portion: string; // medida caseira, ex: "1 unidade média"
    grams: number; // gramas por 1 porção
    step: number; // incremento prático de quantidade
    maxQty: number; // máximo prático por refeição
    // por porção (calculado a partir dos valores por 100g)
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
}

interface TacoFoodDef {
    id: string;
    name: string;
    group: FoodGroup;
    tags?: RestrictionTag[];
    portion: string;
    grams: number;
    step?: number;
    maxQty?: number;
    per100: { kcal: number; p: number; c: number; f: number };
}

const defs: TacoFoodDef[] = [
    // ===== Proteínas: ovos e laticínios =====
    { id: 'taco-ovo', name: 'Ovo cozido', group: 'ovo', tags: ['ovo'], portion: '1 unidade', grams: 50, step: 1, maxQty: 4, per100: { kcal: 146, p: 13.3, c: 0.6, f: 9.5 } },
    { id: 'taco-ovo-mexido', name: 'Ovos mexidos (pouco óleo)', group: 'ovo', tags: ['ovo'], portion: '1 ovo', grams: 55, step: 1, maxQty: 4, per100: { kcal: 165, p: 12.6, c: 0.7, f: 12.0 } },
    { id: 'taco-iogurte-nat', name: 'Iogurte natural', group: 'laticinio', tags: ['lactose'], portion: '1 pote (170g)', grams: 170, step: 0.5, maxQty: 2, per100: { kcal: 51, p: 4.1, c: 1.9, f: 3.0 } },
    { id: 'taco-iogurte-desn', name: 'Iogurte natural desnatado', group: 'laticinio', tags: ['lactose'], portion: '1 pote (170g)', grams: 170, step: 0.5, maxQty: 2, per100: { kcal: 42, p: 3.8, c: 5.8, f: 0.3 } },
    { id: 'taco-queijo-minas', name: 'Queijo minas frescal', group: 'laticinio', tags: ['lactose'], portion: '1 fatia média (30g)', grams: 30, step: 0.5, maxQty: 3, per100: { kcal: 264, p: 17.4, c: 3.2, f: 20.2 } },
    { id: 'taco-cottage', name: 'Queijo cottage', group: 'laticinio', tags: ['lactose'], portion: '3 colheres de sopa (90g)', grams: 90, step: 0.5, maxQty: 2, per100: { kcal: 98, p: 11.0, c: 3.4, f: 4.3 } },
    { id: 'taco-ricota', name: 'Ricota fresca', group: 'laticinio', tags: ['lactose'], portion: '1 fatia média (50g)', grams: 50, step: 0.5, maxQty: 3, per100: { kcal: 140, p: 12.6, c: 3.8, f: 8.1 } },
    { id: 'taco-leite-desn', name: 'Leite desnatado', group: 'laticinio', tags: ['lactose'], portion: '1 copo (200ml)', grams: 200, step: 0.5, maxQty: 2, per100: { kcal: 35, p: 3.4, c: 4.9, f: 0.2 } },
    { id: 'taco-whey', name: 'Whey protein', group: 'suplemento', tags: ['lactose'], portion: '1 scoop (30g)', grams: 30, step: 0.5, maxQty: 1.5, per100: { kcal: 400, p: 80.0, c: 10.0, f: 5.0 } },

    // ===== Proteínas: aves, carnes e peixes =====
    { id: 'taco-frango-grelhado', name: 'Peito de frango grelhado', group: 'ave', tags: ['carne'], portion: '1 filé médio (100g)', grams: 100, step: 0.5, maxQty: 2.5, per100: { kcal: 159, p: 32.0, c: 0, f: 2.5 } },
    { id: 'taco-frango-desfiado', name: 'Frango desfiado', group: 'ave', tags: ['carne'], portion: '4 colheres de sopa (80g)', grams: 80, step: 0.5, maxQty: 3, per100: { kcal: 163, p: 31.5, c: 0, f: 3.2 } },
    { id: 'taco-patinho', name: 'Patinho grelhado', group: 'carne', tags: ['carne', 'carne-vermelha'], portion: '1 bife médio (100g)', grams: 100, step: 0.5, maxQty: 2.5, per100: { kcal: 219, p: 35.9, c: 0, f: 7.3 } },
    { id: 'taco-carne-moida', name: 'Carne moída magra refogada', group: 'carne', tags: ['carne', 'carne-vermelha'], portion: '4 colheres de sopa (90g)', grams: 90, step: 0.5, maxQty: 2.5, per100: { kcal: 212, p: 26.7, c: 0, f: 10.9 } },
    { id: 'taco-lombo', name: 'Lombo suíno assado', group: 'porco', tags: ['carne', 'porco'], portion: '1 fatia média (100g)', grams: 100, step: 0.5, maxQty: 2, per100: { kcal: 210, p: 35.7, c: 0, f: 6.4 } },
    { id: 'taco-tilapia', name: 'Filé de tilápia grelhado', group: 'peixe', tags: ['peixe'], portion: '1 filé médio (100g)', grams: 100, step: 0.5, maxQty: 2.5, per100: { kcal: 128, p: 26.2, c: 0, f: 2.6 } },
    { id: 'taco-salmao', name: 'Salmão grelhado', group: 'peixe', tags: ['peixe'], portion: '1 posta média (100g)', grams: 100, step: 0.5, maxQty: 2, per100: { kcal: 243, p: 26.1, c: 0, f: 14.5 } },
    { id: 'taco-sardinha', name: 'Sardinha assada', group: 'peixe', tags: ['peixe'], portion: '2 unidades (80g)', grams: 80, step: 0.5, maxQty: 2, per100: { kcal: 208, p: 32.2, c: 0, f: 8.2 } },
    { id: 'taco-atum', name: 'Atum em lata ao natural', group: 'peixe', tags: ['peixe'], portion: '1 lata drenada (120g)', grams: 120, step: 0.5, maxQty: 1.5, per100: { kcal: 116, p: 26.0, c: 0, f: 1.0 } },

    // ===== Carboidratos do prato brasileiro =====
    { id: 'taco-arroz-branco', name: 'Arroz branco cozido', group: 'arroz', portion: '4 colheres de sopa (100g)', grams: 100, step: 0.5, maxQty: 3, per100: { kcal: 128, p: 2.5, c: 28.1, f: 0.2 } },
    { id: 'taco-arroz-integral', name: 'Arroz integral cozido', group: 'arroz', portion: '4 colheres de sopa (100g)', grams: 100, step: 0.5, maxQty: 3, per100: { kcal: 124, p: 2.6, c: 25.8, f: 1.0 } },
    { id: 'taco-feijao-carioca', name: 'Feijão carioca cozido', group: 'feijao', portion: '1 concha média (100g)', grams: 100, step: 0.5, maxQty: 2, per100: { kcal: 76, p: 4.8, c: 13.6, f: 0.5 } },
    { id: 'taco-feijao-preto', name: 'Feijão preto cozido', group: 'feijao', portion: '1 concha média (100g)', grams: 100, step: 0.5, maxQty: 2, per100: { kcal: 77, p: 4.5, c: 14.0, f: 0.5 } },
    { id: 'taco-lentilha', name: 'Lentilha cozida', group: 'leguminosa', portion: '1 concha média (100g)', grams: 100, step: 0.5, maxQty: 2, per100: { kcal: 93, p: 6.3, c: 16.3, f: 0.5 } },
    { id: 'taco-grao-bico', name: 'Grão-de-bico cozido', group: 'leguminosa', portion: '4 colheres de sopa (90g)', grams: 90, step: 0.5, maxQty: 2, per100: { kcal: 130, p: 8.4, c: 21.2, f: 2.1 } },
    { id: 'taco-batata-doce', name: 'Batata-doce cozida', group: 'tuberculo', portion: '1 pedaço médio (100g)', grams: 100, step: 0.5, maxQty: 3, per100: { kcal: 77, p: 0.6, c: 18.4, f: 0.1 } },
    { id: 'taco-batata', name: 'Batata inglesa cozida', group: 'tuberculo', portion: '1 unidade média (100g)', grams: 100, step: 0.5, maxQty: 3, per100: { kcal: 52, p: 1.2, c: 11.9, f: 0 } },
    { id: 'taco-mandioca', name: 'Mandioca (macaxeira) cozida', group: 'tuberculo', portion: '1 pedaço médio (100g)', grams: 100, step: 0.5, maxQty: 2.5, per100: { kcal: 125, p: 0.6, c: 30.1, f: 0.3 } },
    { id: 'taco-inhame', name: 'Inhame cozido', group: 'tuberculo', portion: '1 pedaço médio (100g)', grams: 100, step: 0.5, maxQty: 3, per100: { kcal: 78, p: 1.5, c: 18.9, f: 0.1 } },
    { id: 'taco-macarrao', name: 'Macarrão cozido', group: 'massa', tags: ['gluten'], portion: '1 pegador (110g)', grams: 110, step: 0.5, maxQty: 2.5, per100: { kcal: 131, p: 4.4, c: 26.0, f: 1.0 } },
    { id: 'taco-milho', name: 'Milho verde cozido', group: 'legume', portion: '1 espiga média (100g)', grams: 100, step: 0.5, maxQty: 2, per100: { kcal: 123, p: 3.2, c: 28.6, f: 0.6 } },

    // ===== Carboidratos de café da manhã / lanche =====
    { id: 'taco-pao-integral', name: 'Pão integral', group: 'pao', tags: ['gluten'], portion: '1 fatia (25g)', grams: 25, step: 1, maxQty: 4, per100: { kcal: 253, p: 9.4, c: 49.0, f: 2.9 } },
    { id: 'taco-pao-frances', name: 'Pão francês', group: 'pao', tags: ['gluten'], portion: '1 unidade (50g)', grams: 50, step: 0.5, maxQty: 2, per100: { kcal: 300, p: 8.0, c: 58.6, f: 3.1 } },
    { id: 'taco-tapioca', name: 'Tapioca', group: 'tapioca', portion: '1 unidade média (60g de goma)', grams: 60, step: 0.5, maxQty: 2, per100: { kcal: 240, p: 0.2, c: 59.0, f: 0 } },
    { id: 'taco-aveia', name: 'Aveia em flocos', group: 'cereal', tags: ['gluten'], portion: '2 colheres de sopa (30g)', grams: 30, step: 0.5, maxQty: 2, per100: { kcal: 394, p: 13.9, c: 66.6, f: 8.5 } },
    { id: 'taco-cuscuz', name: 'Cuscuz de milho', group: 'cereal', portion: '1 fatia média (100g)', grams: 100, step: 0.5, maxQty: 2.5, per100: { kcal: 113, p: 2.2, c: 25.3, f: 0.7 } },

    // ===== Frutas =====
    { id: 'taco-banana', name: 'Banana', group: 'fruta', portion: '1 unidade média (80g)', grams: 80, step: 0.5, maxQty: 2, per100: { kcal: 98, p: 1.3, c: 26.0, f: 0.1 } },
    { id: 'taco-maca', name: 'Maçã', group: 'fruta', portion: '1 unidade média (130g)', grams: 130, step: 0.5, maxQty: 2, per100: { kcal: 56, p: 0.3, c: 15.2, f: 0 } },
    { id: 'taco-mamao', name: 'Mamão papaia', group: 'fruta', portion: '1 fatia média (170g)', grams: 170, step: 0.5, maxQty: 2, per100: { kcal: 40, p: 0.5, c: 10.4, f: 0.1 } },
    { id: 'taco-laranja', name: 'Laranja', group: 'fruta', portion: '1 unidade média (130g)', grams: 130, step: 0.5, maxQty: 2, per100: { kcal: 37, p: 1.0, c: 8.9, f: 0.1 } },
    { id: 'taco-manga', name: 'Manga', group: 'fruta', portion: '1 fatia grande (100g)', grams: 100, step: 0.5, maxQty: 2, per100: { kcal: 72, p: 0.4, c: 19.4, f: 0.2 } },
    { id: 'taco-abacaxi', name: 'Abacaxi', group: 'fruta', portion: '1 fatia média (80g)', grams: 80, step: 0.5, maxQty: 2.5, per100: { kcal: 48, p: 0.9, c: 12.3, f: 0.1 } },
    { id: 'taco-melancia', name: 'Melancia', group: 'fruta', portion: '1 fatia média (200g)', grams: 200, step: 0.5, maxQty: 2, per100: { kcal: 33, p: 0.9, c: 8.1, f: 0 } },
    { id: 'taco-morango', name: 'Morango', group: 'fruta', portion: '10 unidades (120g)', grams: 120, step: 0.5, maxQty: 2, per100: { kcal: 30, p: 0.9, c: 6.8, f: 0.3 } },
    { id: 'taco-pera', name: 'Pera', group: 'fruta', portion: '1 unidade média (130g)', grams: 130, step: 0.5, maxQty: 2, per100: { kcal: 53, p: 0.6, c: 14.0, f: 0.1 } },
    { id: 'taco-goiaba', name: 'Goiaba', group: 'fruta', portion: '1 unidade média (170g)', grams: 170, step: 0.5, maxQty: 1.5, per100: { kcal: 54, p: 1.1, c: 13.0, f: 0.4 } },
    { id: 'taco-tangerina', name: 'Tangerina', group: 'fruta', portion: '1 unidade média (135g)', grams: 135, step: 0.5, maxQty: 2, per100: { kcal: 38, p: 0.7, c: 9.6, f: 0.1 } },

    // ===== Legumes e verduras =====
    { id: 'taco-brocolis', name: 'Brócolis cozido', group: 'legume', portion: '3 colheres de sopa (90g)', grams: 90, step: 0.5, maxQty: 3, per100: { kcal: 25, p: 2.1, c: 4.4, f: 0.5 } },
    { id: 'taco-cenoura', name: 'Cenoura cozida', group: 'legume', portion: '3 colheres de sopa (80g)', grams: 80, step: 0.5, maxQty: 3, per100: { kcal: 30, p: 0.8, c: 6.7, f: 0.2 } },
    { id: 'taco-abobrinha', name: 'Abobrinha refogada', group: 'legume', portion: '3 colheres de sopa (90g)', grams: 90, step: 0.5, maxQty: 3, per100: { kcal: 27, p: 1.1, c: 4.3, f: 0.9 } },
    { id: 'taco-chuchu', name: 'Chuchu cozido', group: 'legume', portion: '3 colheres de sopa (90g)', grams: 90, step: 0.5, maxQty: 3, per100: { kcal: 19, p: 0.4, c: 4.8, f: 0 } },
    { id: 'taco-couve-flor', name: 'Couve-flor cozida', group: 'legume', portion: '3 buquês (90g)', grams: 90, step: 0.5, maxQty: 3, per100: { kcal: 19, p: 1.2, c: 3.9, f: 0.2 } },
    { id: 'taco-vagem', name: 'Vagem cozida', group: 'legume', portion: '3 colheres de sopa (80g)', grams: 80, step: 0.5, maxQty: 3, per100: { kcal: 25, p: 1.5, c: 5.3, f: 0.2 } },
    { id: 'taco-beterraba', name: 'Beterraba cozida', group: 'legume', portion: '3 fatias (80g)', grams: 80, step: 0.5, maxQty: 3, per100: { kcal: 32, p: 1.3, c: 7.2, f: 0.1 } },
    { id: 'taco-quiabo', name: 'Quiabo refogado', group: 'legume', portion: '3 colheres de sopa (80g)', grams: 80, step: 0.5, maxQty: 3, per100: { kcal: 28, p: 2.0, c: 5.0, f: 0.3 } },
    { id: 'taco-abobora', name: 'Abóbora cozida', group: 'legume', portion: '3 colheres de sopa (90g)', grams: 90, step: 0.5, maxQty: 3, per100: { kcal: 48, p: 1.4, c: 10.8, f: 0.7 } },
    { id: 'taco-couve', name: 'Couve refogada', group: 'folhoso', portion: '2 colheres de sopa (40g)', grams: 40, step: 0.5, maxQty: 3, per100: { kcal: 90, p: 3.1, c: 8.7, f: 5.4 } },
    { id: 'taco-espinafre', name: 'Espinafre cozido', group: 'folhoso', portion: '2 colheres de sopa (50g)', grams: 50, step: 0.5, maxQty: 3, per100: { kcal: 23, p: 2.7, c: 3.4, f: 0.3 } },
    { id: 'taco-salada', name: 'Salada de alface e tomate', group: 'folhoso', portion: '1 prato de sobremesa (80g)', grams: 80, step: 0.5, maxQty: 3, per100: { kcal: 14, p: 0.9, c: 2.7, f: 0.2 } },

    // ===== Gorduras boas =====
    { id: 'taco-azeite', name: 'Azeite de oliva extra virgem', group: 'azeite', portion: '1 colher de sopa (13ml)', grams: 13, step: 0.5, maxQty: 1, per100: { kcal: 884, p: 0, c: 0, f: 100 } },
    { id: 'taco-castanha-para', name: 'Castanha-do-pará', group: 'oleaginosa', tags: ['oleaginosa'], portion: '2 unidades (8g)', grams: 8, step: 1, maxQty: 3, per100: { kcal: 643, p: 14.5, c: 15.1, f: 63.5 } },
    { id: 'taco-castanha-caju', name: 'Castanha de caju sem sal', group: 'oleaginosa', tags: ['oleaginosa'], portion: '1 punhado pequeno (15g)', grams: 15, step: 0.5, maxQty: 2, per100: { kcal: 570, p: 18.5, c: 29.1, f: 46.3 } },
    { id: 'taco-amendoas', name: 'Amêndoas', group: 'oleaginosa', tags: ['oleaginosa'], portion: '10 unidades (12g)', grams: 12, step: 0.5, maxQty: 2, per100: { kcal: 579, p: 21.2, c: 21.6, f: 49.9 } },
    { id: 'taco-amendoim-nat', name: 'Amendoim sem sal', group: 'oleaginosa', tags: ['oleaginosa'], portion: '1 colher de sopa (15g)', grams: 15, step: 0.5, maxQty: 2, per100: { kcal: 544, p: 27.2, c: 20.3, f: 43.9 } },
    { id: 'taco-pasta-amendoim', name: 'Pasta de amendoim integral', group: 'oleaginosa', tags: ['oleaginosa'], portion: '1 colher de sopa (15g)', grams: 15, step: 0.5, maxQty: 2, per100: { kcal: 590, p: 25.0, c: 20.0, f: 46.0 } },
    { id: 'taco-abacate', name: 'Abacate', group: 'fruta', portion: '2 colheres de sopa (60g)', grams: 60, step: 0.5, maxQty: 2, per100: { kcal: 96, p: 1.2, c: 6.0, f: 8.4 } },
];

function round1(value: number) {
    return Math.round(value * 10) / 10;
}

export const tacoFoods: TacoFood[] = defs.map((def) => ({
    id: def.id,
    name: def.name,
    group: def.group,
    tags: def.tags || [],
    portion: def.portion,
    grams: def.grams,
    step: def.step ?? 0.5,
    maxQty: def.maxQty ?? 3,
    calories: round1((def.per100.kcal * def.grams) / 100),
    protein: round1((def.per100.p * def.grams) / 100),
    carbs: round1((def.per100.c * def.grams) / 100),
    fat: round1((def.per100.f * def.grams) / 100),
}));
