// Intelligent Matching Algorithm Script
// Compares Lost & Found reports based on Category, Color, Zone, Date, and Description text

// Weights for similarity attributes (Total = 100%)
let WEIGHTS = {
    category: 0.24,
    color: 0.18,
    location: 0.22,
    date: 0.12,
    description: 0.12,
    image: 0.12
};

// Common stop words to exclude during text matching
let stopWords = ["a", "an", "the", "and", "or", "in", "on", "at", "to", "for", "of", "with", "my", "lost", "found", "near", "left", "please", "is", "was"];

// Campus zone distance map
let zoneMap = {
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

// Color group similarity helper
function getColorScore(color1, color2) {
    if (!color1 || !color2) return 0;
    let c1 = normalizeText(color1);
    let c2 = normalizeText(color2);

    if (c1 === c2) return 1.0;

    let colorGroups = [
        ["black", "charcoal", "grey", "gray", "silver"],
        ["white", "cream", "ivory", "beige"],
        ["red", "maroon", "burgundy", "pink"],
        ["blue", "navy", "teal", "cyan"],
        ["green", "olive", "lime"],
        ["brown", "tan", "gold", "orange", "yellow"]
    ];

    let sameGroup = colorGroups.some(group => group.includes(c1) && group.includes(c2));
    if (sameGroup) return 0.65;

    if ((c1 === "black" && c2 === "grey") || (c1 === "grey" && c2 === "black")) return 0.7;
    if ((c1 === "white" && c2 === "grey") || (c1 === "grey" && c2 === "white")) return 0.6;
    if ((c1 === "red" && c2 === "brown") || (c1 === "brown" && c2 === "red")) return 0.5;

    return 0.0;
}

// Zone location similarity helper
function getLocationScore(zone1, zone2) {
    if (!zone1 || !zone2) return 0.1;
    let z1 = normalizeText(zone1);
    let z2 = normalizeText(zone2);

    if (z1 === z2) return 1.0;

    let knownZone1 = Object.keys(zoneMap).find(zone => normalizeText(zone) === z1);
    let knownZone2 = Object.keys(zoneMap).find(zone => normalizeText(zone) === z2);
    if (knownZone1 && zoneMap[knownZone1].some(zone => normalizeText(zone) === z2)) return 0.7;
    if (knownZone2 && zoneMap[knownZone2].some(zone => normalizeText(zone) === z1)) return 0.7;

    let customLocationScore = getTextSimilarity(z1, z2);
    if (customLocationScore >= 0.5) return 0.75;
    if (customLocationScore >= 0.25) return 0.5;

    return 0.3;
}

// Date difference similarity helper
function getDateScore(date1, date2) {
    if (!date1 || !date2) return 0;
    let d1 = Date.parse(`${date1}T00:00:00Z`);
    let d2 = Date.parse(`${date2}T00:00:00Z`);
    if (Number.isNaN(d1) || Number.isNaN(d2)) return 0;
    let diffDays = Math.abs(Math.round((d1 - d2) / (1000 * 60 * 60 * 24)));

    if (diffDays === 0) return 1.0;
    if (diffDays === 1) return 0.85;
    if (diffDays <= 3) return 0.65;
    if (diffDays <= 7) return 0.40;
    if (diffDays <= 14) return 0.20;

    return 0.0;
}

// Description Jaccard text similarity helper
function getDescriptionScore(desc1, desc2) {
    if (!desc1 || !desc2) return 0;

    return getTextSimilarity(desc1, desc2);
}

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
    let words1 = getTextTokens(text1);
    let words2 = getTextTokens(text2);
    if (words1.length === 0 || words2.length === 0) return 0;

    let set1 = new Set(words1);
    let set2 = new Set(words2);
    let commonCount = [...set1].filter(word => set2.has(word)).length;
    let unionCount = new Set([...set1, ...set2]).size;
    let jaccard = unionCount ? commonCount / unionCount : 0;
    let containment = Math.min(commonCount / set1.size, commonCount / set2.size);

    return Math.max(jaccard, containment * 0.85);
}

function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
}

function getImageSignature(imageSource) {
    if (!imageSource || typeof imageSource !== "string") {
        return { exists: false, brightness: 0, rgb: { r: 0, g: 0, b: 0 } };
    }

    const clean = imageSource.trim();
    if (!clean) {
        return { exists: false, brightness: 0, rgb: { r: 0, g: 0, b: 0 } };
    }

    if (clean.startsWith("data:image")) {
        try {
            const base64 = clean.replace(/^data:image\/[a-zA-Z0-9.+-]+;base64,/, "");
            const binary = atob(base64);
            const bytes = new Uint8Array(binary.length);

            for (let i = 0; i < binary.length; i++) {
                bytes[i] = binary.charCodeAt(i);
            }

            let totalR = 0, totalG = 0, totalB = 0, count = 0;
            const sampleStep = 4;

            for (let i = 0; i + 2 < bytes.length; i += sampleStep) {
                if (count > 400) break;
                totalR += bytes[i];
                totalG += bytes[i + 1];
                totalB += bytes[i + 2];
                count++;
            }

            if (count > 0) {
                const rgb = {
                    r: totalR / count,
                    g: totalG / count,
                    b: totalB / count
                };
                const brightness = (rgb.r + rgb.g + rgb.b) / (3 * 255);
                return { exists: true, brightness: clamp(brightness, 0, 1), rgb };
            }
        } catch (error) {
            // Fall through to URL-based fallback below.
        }
    }

    let hash = 0;
    for (let i = 0; i < clean.length; i++) {
        hash = (hash * 31 + clean.charCodeAt(i)) >>> 0;
    }

    const rgb = {
        r: hash % 256,
        g: (hash * 7) % 256,
        b: (hash * 13) % 256
    };

    return {
        exists: true,
        brightness: clamp((rgb.r + rgb.g + rgb.b) / (3 * 255), 0, 1),
        rgb
    };
}

function getImageScore(image1, image2, features1, features2) {
    if (!image1 || !image2 || !features1 || !features2) return 0;
    if (!Array.isArray(features1.histogram) || !Array.isArray(features2.histogram)) return 0;

    let histogramDistance = features1.histogram.reduce((total, value, index) => {
        return total + Math.abs(value - (features2.histogram[index] || 0));
    }, 0);
    let histogramScore = clamp(1 - histogramDistance / 2, 0, 1);

    let hashLength = Math.min(features1.perceptualHash.length, features2.perceptualHash.length);
    let matchingBits = 0;
    for (let index = 0; index < hashLength; index++) {
        if (features1.perceptualHash[index] === features2.perceptualHash[index]) matchingBits++;
    }
    let hashScore = hashLength ? matchingBits / hashLength : 0;

    let edgeScore = 1 - Math.abs(features1.edgeStrength - features2.edgeStrength);
    let brightnessScore = 1 - Math.abs(features1.averageBrightness - features2.averageBrightness);
    let aspectScore = 1 - clamp(Math.abs(Math.log(features1.aspectRatio / features2.aspectRatio)), 0, 1);

    return clamp(
        histogramScore * 0.35 + hashScore * 0.35 + edgeScore * 0.15 + brightnessScore * 0.1 + aspectScore * 0.05,
        0,
        1
    );
}

// Main function to calculate total match score between target item and candidate item
function calculateMatchScore(targetItem, candidateItem) {
    // Weighted score out of 100 points; each component is normalized to 0..1 then multiplied by its weight.
    let catScore = normalizeText(targetItem.category) === normalizeText(candidateItem.category) ? 1.0 : 0.0;
    if (!catScore) catScore = getTextSimilarity(targetItem.category, candidateItem.category) >= 0.6 ? 0.7 : 0;
    let colorScore = getColorScore(targetItem.color, candidateItem.color);
    let locScore = getLocationScore(targetItem.zone, candidateItem.zone);
    let dateScore = getDateScore(targetItem.date, candidateItem.date);
    let descScore = getDescriptionScore(targetItem.description, candidateItem.description);
    let imageScore = getImageScore(targetItem.image, candidateItem.image, targetItem.imageFeatures, candidateItem.imageFeatures);

    let catPts = catScore * WEIGHTS.category * 100;
    let colorPts = colorScore * WEIGHTS.color * 100;
    let locPts = locScore * WEIGHTS.location * 100;
    let datePts = dateScore * WEIGHTS.date * 100;
    let descPts = descScore * WEIGHTS.description * 100;
    let imagePts = imageScore * WEIGHTS.image * 100;

    let totalPts = catPts + colorPts + locPts + datePts + descPts + imagePts;
    let evidenceCount = [catScore, colorScore, locScore, dateScore, descScore, imageScore]
        .filter(score => score >= 0.5).length;
    if (evidenceCount < 2) totalPts *= 0.75;
    let matchPercentage = Math.round(totalPts);

    let reasons = [];
    if (catScore === 1.0) reasons.push(`Same category (${candidateItem.category})`);
    if (colorScore === 1.0) reasons.push(`Exact color match (${candidateItem.color})`);
    else if (colorScore > 0) reasons.push(`Similar color tone (${candidateItem.color})`);

    if (locScore === 1.0) reasons.push(`Same campus zone (${candidateItem.zone})`);
    else if (locScore >= 0.7) reasons.push(`Nearby campus zone (${candidateItem.zone})`);

    if (dateScore === 1.0) reasons.push(`Reported on exact same date`);
    else if (dateScore >= 0.85) reasons.push(`Reported 1 day apart`);

    if (descScore > 0.2) reasons.push(`Description words overlap (${Math.round(descScore * 100)}%)`);
    if (imageScore > 0.7) reasons.push(`Images look visually similar`);
    else if (imageScore > 0.45) reasons.push(`Image color/brightness is aligned`);

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
        reasons: reasons
    };
}

// Find opposite type matches (Lost -> Found, Found -> Lost)
// Strictly excludes reports created by the SAME user so User 1 only matches with User 2, User 3, etc.
function findMatches(targetItem, allReports) {
    if (!targetItem) return [];

    let oppositeType = targetItem.type === "lost" ? "found" : "lost";
    
    let candidates = allReports.filter(r => 
        r.type === oppositeType && 
        r.id !== targetItem.id
    );

    let results = candidates.map(c => calculateMatchScore(targetItem, c));
    
    // Filter relevant matches:
    // Requires category match > 0 OR overall match score >= 55%
    let relevantResults = results.filter(res => {
        let hasCatMatch = res.breakdown && res.breakdown.category && res.breakdown.category.pts > 0;
        return hasCatMatch || res.score >= 55;
    });

    relevantResults.sort((a, b) => b.score - a.score);

    return relevantResults;
}
