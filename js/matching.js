// Intelligent Matching Algorithm Script
// Compares Lost & Found reports based on Category, Color, Zone, Date, and Description text

// Weights for similarity attributes (Total = 100%)
let WEIGHTS = {
    category: 0.25,
    color: 0.20,
    location: 0.25,
    date: 0.15,
    description: 0.15
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
    let c1 = color1.toLowerCase().trim();
    let c2 = color2.toLowerCase().trim();

    if (c1 === c2) return 1.0;

    if ((c1 === "black" && c2 === "grey") || (c1 === "grey" && c2 === "black")) return 0.7;
    if ((c1 === "white" && c2 === "grey") || (c1 === "grey" && c2 === "white")) return 0.6;
    if ((c1 === "red" && c2 === "brown") || (c1 === "brown" && c2 === "red")) return 0.5;

    return 0.0;
}

// Zone location similarity helper
function getLocationScore(zone1, zone2) {
    if (!zone1 || !zone2) return 0.1;
    let z1 = zone1.trim();
    let z2 = zone2.trim();

    if (z1 === z2) return 1.0;

    if (zoneMap[z1] && zoneMap[z1].includes(z2)) return 0.7;
    if (zoneMap[z2] && zoneMap[z2].includes(z1)) return 0.7;

    return 0.3;
}

// Date difference similarity helper
function getDateScore(date1, date2) {
    if (!date1 || !date2) return 0;
    let d1 = new Date(date1);
    let d2 = new Date(date2);
    let diffDays = Math.abs(Math.floor((d1 - d2) / (1000 * 60 * 60 * 24)));

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

    let getWords = (text) => {
        let clean = text.toLowerCase().replace(/[^a-z0-9\s]/g, "");
        let words = clean.split(/\s+/);
        return words.filter(w => w.length > 1 && !stopWords.includes(w));
    };

    let words1 = getWords(desc1);
    let words2 = getWords(desc2);

    if (words1.length === 0 || words2.length === 0) return 0;

    let common = words1.filter(w => words2.includes(w));
    let uniqueWords = new Set([...words1, ...words2]);

    return common.length / uniqueWords.size;
}

// Main function to calculate total match score between target item and candidate item
function calculateMatchScore(targetItem, candidateItem) {
    // 1. Category (25% weight -> max 25.0 pts)
    let catScore = targetItem.category === candidateItem.category ? 1.0 : 0.0;
    let catPts = catScore * 25.0;

    // 2. Color (20% weight -> max 20.0 pts)
    let colorScore = getColorScore(targetItem.color, candidateItem.color);
    let colorPts = colorScore * 20.0;

    // 3. Location (25% weight -> max 25.0 pts)
    let locScore = getLocationScore(targetItem.zone, candidateItem.zone);
    let locPts = locScore * 25.0;

    // 4. Date (15% weight -> max 15.0 pts)
    let dateScore = getDateScore(targetItem.date, candidateItem.date);
    let datePts = dateScore * 15.0;

    // 5. Description (15% weight -> max 15.0 pts)
    let descScore = getDescriptionScore(targetItem.description, candidateItem.description);
    let descPts = descScore * 15.0;

    // Total Score Calculation (Sum of points out of 100%)
    let totalPts = catPts + colorPts + locPts + datePts + descPts;
    let matchPercentage = Math.round(totalPts);

    // Human readable reasons list
    let reasons = [];
    if (catScore === 1.0) reasons.push(`Same category (${candidateItem.category})`);
    if (colorScore === 1.0) reasons.push(`Exact color match (${candidateItem.color})`);
    else if (colorScore > 0) reasons.push(`Similar color tone (${candidateItem.color})`);

    if (locScore === 1.0) reasons.push(`Same campus zone (${candidateItem.zone})`);
    else if (locScore >= 0.7) reasons.push(`Nearby campus zone (${candidateItem.zone})`);

    if (dateScore === 1.0) reasons.push(`Reported on exact same date`);
    else if (dateScore >= 0.85) reasons.push(`Reported 1 day apart`);

    if (descScore > 0.2) reasons.push(`Description words overlap (${Math.round(descScore * 100)}%)`);

    return {
        candidate: candidateItem,
        score: matchPercentage,
        totalPts: parseFloat(totalPts.toFixed(1)),
        breakdown: {
            category: { matchPct: Math.round(catScore * 100), pts: parseFloat(catPts.toFixed(1)), maxPts: 25 },
            color: { matchPct: Math.round(colorScore * 100), pts: parseFloat(colorPts.toFixed(1)), maxPts: 20 },
            location: { matchPct: Math.round(locScore * 100), pts: parseFloat(locPts.toFixed(1)), maxPts: 25 },
            date: { matchPct: Math.round(dateScore * 100), pts: parseFloat(datePts.toFixed(1)), maxPts: 15 },
            description: { matchPct: Math.round(descScore * 100), pts: parseFloat(descPts.toFixed(1)), maxPts: 15 }
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
