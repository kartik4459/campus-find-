// Intelligent Matching Algorithm Service (Server-side)
// Replicates the CampusFind algorithmic scoring engine for Node.js

const WEIGHTS = {
    category: 0.24,
    color: 0.18,
    location: 0.22,
    date: 0.12,
    description: 0.12,
    image: 0.12
};

const stopWords = [
    "a", "an", "the",
    "and", "or", "but",
    "in", "on", "at", "near",
    "to", "from", "for", "of", "with",
    "my", "me", "i", "mine",
    "lost", "found", "missing",
    "left", "please", "help", "find",
    "is", "was", "were", "are", "am",
    "it", "this", "that",
    "has", "have", "had",
    "there", "here"
];

const zoneMap = {
    "Library": ["Main Block", "Laboratory", "Admin Block"],
    "Main Block": ["Library", "Cafeteria", "Admin Block", "Auditorium"],
    "Cafeteria": ["Main Block", "Hostel", "Sports Complex"],
    "Hostel": ["Cafeteria", "Sports Complex"],
    "Sports Complex": ["Hostel", "Cafeteria", "Parking"],
    "Parking": ["Sports Complex", "Auditorium", "Main Block"],
    "Auditorium": ["Main Block", "Parking"],
    "Laboratory": ["Library", "Main Block"],
    "Admin Block": ["Main Block", "Library"]
};

function normalizeText(value) {
    return String(value || "")
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

function getTextTokens(value) {
    return normalizeText(value)
        .split(" ")
        .filter(word => word.length > 1 && !stopWords.includes(word));
}

function getTextSimilarity(text1, text2) {
    const words1 = getTextTokens(text1);
    const words2 = getTextTokens(text2);
    if (words1.length === 0 || words2.length === 0) return 0;

    const set1 = new Set(words1);
    const set2 = new Set(words2);
    const commonCount = [...set1].filter(word => set2.has(word)).length;
    const unionCount = new Set([...set1, ...set2]).size;
    const jaccard = unionCount ? commonCount / unionCount : 0;
    const containment = Math.min(commonCount / set1.size, commonCount / set2.size);

    return Math.max(jaccard, containment * 0.85);
}

function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
}

function getColorScore(color1, color2) {
    if (!color1 || !color2) return 0;
    const c1 = normalizeText(color1);
    const c2 = normalizeText(color2);

    if (c1 === c2) return 1.0;

    const colorGroups = [
        ["black", "charcoal", "grey", "gray", "silver"],
        ["white", "cream", "ivory", "beige"],
        ["red", "maroon", "burgundy", "pink"],
        ["blue", "navy", "teal", "cyan"],
        ["green", "olive", "lime"],
        ["brown", "tan", "gold", "orange", "yellow"]
    ];

    const sameGroup = colorGroups.some(group => group.includes(c1) && group.includes(c2));
    if (sameGroup) return 0.65;

    if ((c1 === "black" && c2 === "grey") || (c1 === "grey" && c2 === "black")) return 0.7;
    if ((c1 === "white" && c2 === "grey") || (c1 === "grey" && c2 === "white")) return 0.6;
    if ((c1 === "red" && c2 === "brown") || (c1 === "brown" && c2 === "red")) return 0.5;

    return 0.0;
}

function getLocationScore(zone1, zone2) {
    if (!zone1 || !zone2) return 0.1;
    const z1 = normalizeText(zone1);
    const z2 = normalizeText(zone2);

    if (z1 === z2) return 1.0;

    const knownZone1 = Object.keys(zoneMap).find(zone => normalizeText(zone) === z1);
    const knownZone2 = Object.keys(zoneMap).find(zone => normalizeText(zone) === z2);
    if (knownZone1 && zoneMap[knownZone1].some(zone => normalizeText(zone) === z2)) return 0.7;
    if (knownZone2 && zoneMap[knownZone2].some(zone => normalizeText(zone) === z1)) return 0.7;

    const customLocationScore = getTextSimilarity(z1, z2);
    if (customLocationScore >= 0.5) return 0.75;
    if (customLocationScore >= 0.25) return 0.5;

    return 0.3;
}

function getDateScore(date1, date2) {
    if (!date1 || !date2) return 0;
    const d1 = Date.parse(`${date1}T00:00:00Z`);
    const d2 = Date.parse(`${date2}T00:00:00Z`);
    if (Number.isNaN(d1) || Number.isNaN(d2)) return 0;
    const diffDays = Math.abs(Math.round((d1 - d2) / (1000 * 60 * 60 * 24)));

    if (diffDays === 0) return 1.0;
    if (diffDays === 1) return 0.85;
    if (diffDays <= 3) return 0.65;
    if (diffDays <= 7) return 0.40;
    if (diffDays <= 14) return 0.20;

    return 0.0;
}

function getDescriptionScore(desc1, desc2) {
    if (!desc1 || !desc2) return 0;
    return getTextSimilarity(desc1, desc2);
}

function getImageScore(image1, image2, features1, features2) {
    if (!image1 || !image2 || !features1 || !features2) return 0;
    if (!Array.isArray(features1.histogram) || !Array.isArray(features2.histogram)) return 0;

    const histogramDistance = features1.histogram.reduce((total, value, index) => {
        return total + Math.abs(value - (features2.histogram[index] || 0));
    }, 0);
    const histogramScore = clamp(1 - histogramDistance / 2, 0, 1);

    const hashLength = Math.min((features1.perceptualHash || "").length, (features2.perceptualHash || "").length);
    let matchingBits = 0;
    for (let index = 0; index < hashLength; index++) {
        if (features1.perceptualHash[index] === features2.perceptualHash[index]) matchingBits++;
    }
    const hashScore = hashLength ? matchingBits / hashLength : 0;

    const edgeScore = 1 - Math.abs((features1.edgeStrength || 0) - (features2.edgeStrength || 0));
    const brightnessScore = 1 - Math.abs((features1.averageBrightness || 0) - (features2.averageBrightness || 0));
    const aspect1 = features1.aspectRatio || 1;
    const aspect2 = features2.aspectRatio || 1;
    const aspectScore = 1 - clamp(Math.abs(Math.log(aspect1 / aspect2)), 0, 1);

    return clamp(
        histogramScore * 0.35 + hashScore * 0.35 + edgeScore * 0.15 + brightnessScore * 0.1 + aspectScore * 0.05,
        0,
        1
    );
}

function calculateMatchScore(targetItem, candidateItem) {
    let catScore = normalizeText(targetItem.category) === normalizeText(candidateItem.category) ? 1.0 : 0.0;
    if (!catScore) catScore = getTextSimilarity(targetItem.category, candidateItem.category) >= 0.6 ? 0.7 : 0;
    const colorScore = getColorScore(targetItem.color, candidateItem.color);
    const locScore = getLocationScore(targetItem.zone, candidateItem.zone);
    const dateScore = getDateScore(targetItem.date, candidateItem.date);
    const descScore = getDescriptionScore(targetItem.description, candidateItem.description);
    const imageScore = getImageScore(targetItem.image, candidateItem.image, targetItem.imageFeatures, candidateItem.imageFeatures);

    const catPts = catScore * WEIGHTS.category * 100;
    const colorPts = colorScore * WEIGHTS.color * 100;
    const locPts = locScore * WEIGHTS.location * 100;
    const datePts = dateScore * WEIGHTS.date * 100;
    const descPts = descScore * WEIGHTS.description * 100;
    const imagePts = imageScore * WEIGHTS.image * 100;

    let totalPts = catPts + colorPts + locPts + datePts + descPts + imagePts;
    const evidenceCount = [catScore, colorScore, locScore, dateScore, descScore, imageScore]
        .filter(score => score >= 0.5).length;
    if (evidenceCount < 2) totalPts *= 0.75;
    const matchPercentage = Math.round(totalPts);

    const reasons = [];
    if (catScore === 1.0) reasons.push(`Same category (${candidateItem.category})`);
    if (colorScore === 1.0) reasons.push(`Exact color match (${candidateItem.color})`);
    else if (colorScore > 0) reasons.push(`Similar color tone (${candidateItem.color})`);

    if (locScore === 1.0) reasons.push(`Same campus zone (${candidateItem.zone})`);
    else if (locScore >= 0.7) reasons.push(`Nearby campus zone (${candidateItem.zone})`);

    if (dateScore === 1.0) reasons.push('Reported on exact same date');
    else if (dateScore >= 0.85) reasons.push('Reported 1 day apart');

    if (descScore > 0.2) reasons.push(`Description words overlap (${Math.round(descScore * 100)}%)`);
    if (imageScore > 0.7) reasons.push('Images look visually similar');
    else if (imageScore > 0.45) reasons.push('Image color/brightness is aligned');

    return {
        candidate: candidateItem,
        score: matchPercentage,
        totalPts: parseFloat(totalPts.toFixed(1)),
        breakdown: {
            category: { matchPct: Math.round(catScore * 100), pts: parseFloat(catPts.toFixed(1)), maxPts: Math.round(WEIGHTS.category * 100) },
            color: { matchPct: Math.round(colorScore * 100), pts: parseFloat(colorPts.toFixed(1)), maxPts: Math.round(WEIGHTS.color * 100) },
            location: { matchPct: Math.round(locScore * 100), pts: parseFloat(locPts.toFixed(1)), maxPts: Math.round(WEIGHTS.location * 100) },
            date: { matchPct: Math.round(dateScore * 100), pts: parseFloat(datePts.toFixed(1)), maxPts: Math.round(WEIGHTS.date * 100) },
            description: { matchPct: Math.round(descScore * 100), pts: parseFloat(descPts.toFixed(1)), maxPts: Math.round(WEIGHTS.description * 100) },
            image: { matchPct: Math.round(imageScore * 100), pts: parseFloat(imagePts.toFixed(1)), maxPts: Math.round(WEIGHTS.image * 100) }
        },
        reasons
    };
}

function findMatches(targetItem, allReports) {
    if (!targetItem || !Array.isArray(allReports)) return [];

    const oppositeType = targetItem.type === 'lost' ? 'found' : 'lost';

    const candidates = allReports.filter(r =>
        r &&
        r.type === oppositeType &&
        String(r.id) !== String(targetItem.id)
    );

    const results = candidates.map(c => calculateMatchScore(targetItem, c));

    const relevantResults = results.filter(res => {
        const hasCatMatch = res.breakdown && res.breakdown.category && res.breakdown.category.pts > 0;
        return hasCatMatch || res.score >= 55;
    });

    relevantResults.sort((a, b) => b.score - a.score);
    return relevantResults;
}

module.exports = {
    WEIGHTS,
    stopWords,
    zoneMap,
    normalizeText,
    getTextTokens,
    getTextSimilarity,
    getColorScore,
    getLocationScore,
    getDateScore,
    getDescriptionScore,
    getImageScore,
    calculateMatchScore,
    findMatches
};
