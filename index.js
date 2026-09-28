const express = require('express');
const cors = require('cors');
require('dotenv').config();
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const app = express();
const port = process.env.PORT || 5000;

// middleware
app.use(cors());

app.use(express.json())





const uri = `mongodb+srv://${process.env.DB}:${process.env.password}@cluster0.hwuf8vx.mongodb.net/?appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

async function run() {
    try {
        // Connect the client to the server	(optional starting in v4.7)
        // await client.connect();

        const DB = client.db('EnglihDB');
        const vocabulary = DB.collection('vocabularys');
        const vocabularys = DB.collection('newListListining');
        const levels = DB.collection('levels');
        const moviesvocab = DB.collection('moviesvocab');
        const grammerNotes = DB.collection('grammerNotes');


        // app.post('/vocabulary', async (req, res) => {
        //     const dataUpload=req.body;
        //     const result = await vocabulary.insertMany(dataUpload);
        //     res.send({ status: true, data: result });
        // }) 


        app.get('/movies', async (req, res) => {

            const result = await moviesvocab.find().toArray();
            res.send({ status: true, data: result });
        })

        app.get('/vocabulary/:level', async (req, res) => {
            const { level } = req.params;
            const query = { level: isNaN(level) ? level : parseInt(level) };
            const result = await vocabulary.find(query).toArray();
            res.send({ status: true, data: result });

        })

        app.get('/levels', async (req, res) => {
            const cursor = levels.find();
            const result = await cursor.toArray();
            res.send({ status: true, data: result });

        })

        app.get('/vocabularydetails/:id', async (req, res) => {


            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await vocabulary.findOne(query);
            res.send({ status: true, data: result });

        })

        app.get('/grammernotes', async (req, res) => {
            const result = await grammerNotes.find().toArray();
            res.send({ status: true, data: result });
        })

        // Send a ping to confirm a successful connection
        // await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);






// Trust reverse proxies (Vercel, Cloudflare, etc.) for accurate client IP detection
app.set('trust proxy', true);

// ==========================================
// IP-BASED RATE LIMITER FOR SENTENCE CHECKER
// ==========================================
const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW_MS = parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || 15 * 60 * 1000; // 15 minutes default
const RATE_LIMIT_MAX = parseInt(process.env.RATE_LIMIT_MAX, 10) || 15; // 15 requests default

function getClientIp(req) {
    const forwarded = req.headers['x-forwarded-for'];
    if (forwarded) {
        return forwarded.split(',')[0].trim();
    }
    return req.socket?.remoteAddress || req.ip || '127.0.0.1';
}

function sentenceRateLimiter(req, res, next) {
    const clientIp = getClientIp(req);
    const now = Date.now();
    
    let record = rateLimitMap.get(clientIp);
    if (!record || (now - record.startTime > RATE_LIMIT_WINDOW_MS)) {
        record = { count: 1, startTime: now };
        rateLimitMap.set(clientIp, record);
    } else {
        record.count += 1;
    }

    const timeElapsed = now - record.startTime;
    const timeRemainingMs = Math.max(0, RATE_LIMIT_WINDOW_MS - timeElapsed);
    const minutesRemaining = Math.max(1, Math.ceil(timeRemainingMs / 60000));
    const remainingRequests = Math.max(0, RATE_LIMIT_MAX - record.count);

    res.setHeader('X-RateLimit-Limit', RATE_LIMIT_MAX);
    res.setHeader('X-RateLimit-Remaining', remainingRequests);
    res.setHeader('X-RateLimit-Reset', Math.ceil((record.startTime + RATE_LIMIT_WINDOW_MS) / 1000));

    // Periodic cleanup of stale records
    if (rateLimitMap.size > 2000) {
        for (const [key, value] of rateLimitMap.entries()) {
            if (now - value.startTime > RATE_LIMIT_WINDOW_MS) {
                rateLimitMap.delete(key);
            }
        }
    }

    if (record.count > RATE_LIMIT_MAX) {
        return res.status(429).json({
            success: false,
            error: 'RATE_LIMIT_EXCEEDED',
            message: `You have reached the limit of ${RATE_LIMIT_MAX} sentence checks per 15 minutes for your IP. Please try again in about ${minutesRemaining} minute${minutesRemaining > 1 ? 's' : ''}.`,
            limit: RATE_LIMIT_MAX,
            remaining: 0,
            retryAfterMinutes: minutesRemaining
        });

       
    }

    req.userIp = clientIp;
    req.remainingQuota = remainingRequests;
    next();
}

// Endpoint to inspect current quota for client IP
app.get(['/api/check-sentence/quota', '/check-sentence/quota'], (req, res) => {
    const clientIp = getClientIp(req);
    const now = Date.now();
    const record = rateLimitMap.get(clientIp);
    
    let remaining = RATE_LIMIT_MAX;
    let minutesRemaining = 15;
    
    if (record && (now - record.startTime <= RATE_LIMIT_WINDOW_MS)) {
        remaining = Math.max(0, RATE_LIMIT_MAX - record.count);
        minutesRemaining = Math.max(1, Math.ceil((RATE_LIMIT_WINDOW_MS - (now - record.startTime)) / 60000));
    }

    res.json({
        success: true,
        ip: clientIp,
        limit: RATE_LIMIT_MAX,
        remaining,
        windowMinutes: Math.round(RATE_LIMIT_WINDOW_MS / 60000),
        retryAfterMinutes: remaining === 0 ? minutesRemaining : 0
    });
});

// Helper to detect keyboard smashes, gibberish, or non-English letter sequences
function isLikelyGibberish(text) {
    const trimmed = text.trim();
    const words = trimmed.split(/\s+/);
    const vowelRegex = /[aeiouy]/i;

    // Check if long word with no vowels or 5+ consecutive consonants
    const hasRepeatedConsonants = /[bcdfghjklmnpqrstvwxyz]{5,}/i;
    const hasNoVowelsInLongWord = words.some(w => w.length >= 4 && !vowelRegex.test(w));
    const repeatingChars = /(.)\1{4,}/i;

    if (hasNoVowelsInLongWord || hasRepeatedConsonants.test(trimmed) || repeatingChars.test(trimmed)) {
        return true;
    }

    // High consonant-to-vowel ratio in a single word (e.g. dsdgdsdgd)
    if (words.length === 1 && trimmed.length >= 5) {
        const vowels = (trimmed.match(/[aeiouy]/gi) || []).length;
        const consonants = (trimmed.match(/[bcdfghjklmnpqrstvwxz]/gi) || []).length;
        if (vowels === 0 || consonants / (vowels || 1) >= 4) {
            return true;
        }
    }

    return false;
}

// Intelligent fallback handler if Gemini API is unavailable or input is gibberish
function generateFallbackAnalysis(sentence) {
    const trimmed = sentence.trim();
    const lower = trimmed.toLowerCase();

    // Check for gibberish first
    if (isLikelyGibberish(trimmed)) {
        return {
            isCorrect: false,
            originalSentence: trimmed,
            correctedSentence: "Please enter a valid, meaningful English sentence.",
            status: "Needs Correction",
            overallScore: 0,
            bengaliMeaning: "এটি কোনো অর্থপূর্ণ ইংরেজি বাক্য বা শব্দ নয় (এলোমেলো টাইপ করা বর্ণ সমষ্টি)।",
            englishMeaning: "This input consists of meaningless gibberish or random letters with no valid English words or sentence structure.",
            paraphrases: [],
            errors: [
                {
                    type: "Invalid / Gibberish Input",
                    incorrect: trimmed,
                    correction: "Use real English words and complete sentence structure",
                    explanation: "The input contains random characters or non-English letter combinations without linguistic meaning.",
                    bengaliExplanation: "এটি কোনো স্বীকৃত ইংরেজি শব্দ নয়, বরং কিবোর্ডের এলোমেলো অক্ষরের সমষ্টি।"
                }
            ],
            improvedAlternative: "",
            formalAlternative: "",
            casualAlternative: "",
            grammarRuleTips: "A valid English sentence requires meaningful words, a subject, and a finite verb to convey a complete thought.",
            keyVocabulary: []
        };
    }

    let isCorrect = true;
    let status = "Perfect";
    let score = 90;
    let corrected = sentence;
    let errors = [];
    let bengaliMeaning = "বাক্যটির অর্থ: এটি একটি সাধারণ বক্তব্য প্রকাশ করে।";
    let englishMeaning = "The sentence expresses an action or idea.";
    let formalAlt = sentence;
    let casualAlt = sentence;
    let tip = "Ensure subject and verb agree in number and person.";

    if (lower.includes("she don't") || lower.includes("he don't") || lower.includes("it don't")) {
        isCorrect = false;
        status = "Needs Correction";
        score = 60;
        corrected = sentence.replace(/don't/gi, "doesn't").replace(/dont/gi, "doesn't");
        errors.push({
            type: "Subject-Verb Agreement",
            incorrect: "don't",
            correction: "doesn't",
            explanation: "Third-person singular subjects (He, She, It) require 'doesn't' instead of 'don't' in the present simple tense.",
            bengaliExplanation: "Third-person singular subject (He, She, It) এর সাথে present simple এ 'doesn't' বসে, 'don't' নয়।"
        });
        bengaliMeaning = "সে স্টেশনটি কোথায় তা জানে না।";
        englishMeaning = "She does not possess the information regarding where the station is situated.";
        formalAlt = "She is unaware of the station's location.";
        casualAlt = "She has no idea where the station is.";
        tip = "Rule: He/She/It + doesn't + base verb. I/You/We/They + don't + base verb.";
    } else if (lower.includes("he go") || lower.includes("she go")) {
        isCorrect = false;
        status = "Needs Correction";
        score = 65;
        corrected = lower.includes("yesterday") 
            ? sentence.replace(/go/gi, "went") 
            : sentence.replace(/go/gi, "goes");
        errors.push({
            type: lower.includes("yesterday") ? "Past Tense" : "Subject-Verb Agreement",
            incorrect: "go",
            correction: lower.includes("yesterday") ? "went" : "goes",
            explanation: lower.includes("yesterday") ? "Use past tense 'went' because 'yesterday' specifies past time." : "Third-person singular takes 'goes' in simple present.",
            bengaliExplanation: lower.includes("yesterday") ? "অতীতে ঘটা ঘটনার জন্য 'went' ব্যবহার করতে হবে।" : "Third-person singular subject এর পর verb-এ 'es' যুক্ত হয়ে 'goes' হবে।"
        });
        bengaliMeaning = lower.includes("yesterday") ? "সে গতকাল বাজারে গিয়েছিল।" : "সে বিদ্যালয়ে যায়।";
        englishMeaning = "He departed for his destination.";
        formalAlt = "He traveled to the market yesterday.";
        casualAlt = "He headed to the market yesterday.";
        tip = "Watch out for time markers like 'yesterday', 'ago', or 'last week' to use simple past tense.";
    } else if (lower.includes("looking forward to meet")) {
        isCorrect = false;
        status = "Minor Suggestion";
        score = 75;
        corrected = sentence.replace(/meet/gi, "meeting");
        errors.push({
            type: "Prepositional Phrase / Gerund",
            incorrect: "meet",
            correction: "meeting",
            explanation: "In the phrase 'look forward to', 'to' is a preposition, so it must be followed by a gerund (verb+ing).",
            bengaliExplanation: "'Look forward to'-এর 'to' হলো preposition, তাই এরপরে verb-এর সাথে -ing যোগ করে gerund (meeting) করতে হয়।"
        });
        bengaliMeaning = "আমি আপনার সাথে দেখা করার জন্য অধীর আগ্রহে অপেক্ষা করছি।";
        englishMeaning = "I am excited and eagerly anticipating our upcoming meeting.";
        formalAlt = "I eagerly anticipate our forthcoming meeting.";
        casualAlt = "Can't wait to see you!";
        tip = "Remember: 'Look forward to', 'accustomed to', and 'with a view to' are always followed by verb+ing.";
    }

    const fallbackParaphrases = [
        {
            style: "Fluent & Natural",
            text: corrected,
            bengaliMeaning: bengaliMeaning,
            explanation: "Natural and modern phrasing suitable for fluent everyday communication."
        },
        {
            style: "Formal / Academic",
            text: formalAlt,
            bengaliMeaning: bengaliMeaning,
            explanation: "Advanced vocabulary and professional tone suitable for academic or formal context."
        },
        {
            style: "Short & Concise",
            text: corrected.replace(/very\s+/gi, ""),
            bengaliMeaning: bengaliMeaning,
            explanation: "Direct and compact phrasing with minimal filler words."
        },
        {
            style: "Casual / Spoken",
            text: casualAlt,
            bengaliMeaning: bengaliMeaning,
            explanation: "Relaxed, idiomatic phrasing for friendly conversation."
        }
    ];

    return {
        isCorrect,
        originalSentence: sentence,
        correctedSentence: corrected,
        status,
        overallScore: score,
        bengaliMeaning,
        englishMeaning,
        paraphrases: fallbackParaphrases,
        errors,
        improvedAlternative: corrected,
        formalAlternative: formalAlt,
        casualAlternative: casualAlt,
        grammarRuleTips: tip,
        keyVocabulary: [
            { word: "Subject", partOfSpeech: "noun", meaning: "The person or thing performing the action", bengaliMeaning: "কর্তা" },
            { word: "Grammar", partOfSpeech: "noun", meaning: "Rules of sentence structure", bengaliMeaning: "ব্যাকরণ" }
        ],
        isDemoFallback: true,
        notice: "Using demo analysis mode. To connect full Gemini AI, provide GEMINI_API_KEY in server/.env."
    };
}

// POST endpoint for checking sentence grammar & meaning
app.post(['/api/check-sentence', '/check-sentence'], sentenceRateLimiter, async (req, res) => {
    try {
        const { sentence } = req.body;

        if (!sentence || typeof sentence !== 'string' || sentence.trim().length < 2) {
            return res.status(400).json({
                success: false,
                message: "Please provide a valid sentence with at least 2 characters."
            });
        }

        const trimmedSentence = sentence.trim();
        if (trimmedSentence.length > 600) {
            return res.status(400).json({
                success: false,
                message: "Sentence length exceeds 600 characters limit. Please submit a shorter text."
            });
        }

        // Check for gibberish before calling API (instant feedback and saves quota)
        if (isLikelyGibberish(trimmedSentence)) {
            const gibberishResult = generateFallbackAnalysis(trimmedSentence);
            return res.json({
                success: true,
                data: gibberishResult,
                remainingQuota: req.remainingQuota,
                clientIp: req.userIp
            });
        }

        const apiKey = process.env.GEMINI_API_KEY;

        // If API key is not configured, supply helpful demo analysis
        if (!apiKey || apiKey.trim() === '') {
            const fallbackResult = generateFallbackAnalysis(trimmedSentence);
            return res.json({
                success: true,
                data: fallbackResult,
                remainingQuota: req.remainingQuota,
                clientIp: req.userIp
            });
        }

        // Call Gemini API with structured JSON response
        const prompt = `You are an expert English linguist, English Window grammar tutor, and bilingual English-Bengali translator.
Analyze the following sentence or text written by a user: "${trimmedSentence}"

CRITICAL INSTRUCTIONS:
1. FIRST, check if the input consists of random characters, keyboard mash, gibberish, non-words, or meaningless letters (e.g. "dsdgdsdgd", "asdfgh").
   If it is gibberish or invalid:
   - "isCorrect": false
   - "status": "Needs Correction"
   - "overallScore": 0
   - "correctedSentence": "Please write a meaningful English sentence."
   - "bengaliMeaning": "এটি কোনো অর্থপূর্ণ ইংরেজি বাক্য বা শব্দ নয় (এলোমেলো টাইপ করা বর্ণ সমষ্টি)।"
   - "englishMeaning": "This is meaningless gibberish or random letters without real English words or structure."
   - "paraphrases": []
   - "errors": [{ "type": "Invalid / Gibberish Text", "incorrect": "${trimmedSentence}", "correction": "Use real English words", "explanation": "The text is a random string of characters without linguistic meaning.", "bengaliExplanation": "এটি কোনো অর্থপূর্ণ ইংরেজি শব্দ নয়, বরং এলোমেলো বর্ণ।" }]
   - "improvedAlternative": ""
   - "formalAlternative": ""
   - "casualAlternative": ""
   - "grammarRuleTips": "Always use real English words and ensure your sentence has at least a subject and a verb."
   - "keyVocabulary": []

2. If it contains real English words:
   - Carefully examine grammar, subject-verb agreement, tense, prepositions, articles, spelling, and natural spoken/written English flow.
   - Provide the FULL, ACCURATE, AND CONTEXTUAL BENGALI MEANING (সম্পূর্ণ বাক্যের যথাযথ, প্রাঞ্জল ও সাবলীল বাংলা অর্থ). Ensure the Bengali translation translates the ENTIRE sentence naturally, maintaining tone and intended meaning.
   - AUTOMATICALLY GENERATE 4 DIVERSE SENTENCE PARAPHRASES (বাক্য রূপান্তর / প্যারাফ্রেজিং) with distinct styles:
     1. "Fluent & Natural": Modern, natural phrasing used by fluent native speakers.
     2. "Formal / Academic": Sophisticated vocabulary, formal tone suitable for exams, academic writing, or professional emails.
     3. "Short & Concise": Direct, compact phrasing eliminating unnecessary words.
     4. "Casual / Spoken": Idiomatic, friendly conversational phrasing for daily speaking.
     Each paraphrase MUST include:
     - style: ("Fluent & Natural" | "Formal / Academic" | "Short & Concise" | "Casual / Spoken")
     - text: (the rewritten sentence)
     - bengaliMeaning: (the accurate Bengali translation of this specific paraphrased sentence)
     - explanation: (a brief explanation of when or why to use this variation)
   - Write a simplified explanation of what the sentence means in plain English.

You MUST respond strictly with a valid JSON object following this exact schema:
{
  "isCorrect": true,
  "originalSentence": "trimmed original sentence",
  "correctedSentence": "clean, grammatically correct version",
  "status": "Perfect" | "Minor Suggestion" | "Needs Correction",
  "overallScore": 95,
  "bengaliMeaning": "সম্পূর্ণ বাক্যের সঠিক, প্রাঞ্জল ও স্বাভাবিক বাংলা অর্থ (Full sentence Bengali translation)",
  "englishMeaning": "Clear and simple explanation of the full sentence in plain English",
  "paraphrases": [
    {
      "style": "Fluent & Natural | Formal / Academic | Short & Concise | Casual / Spoken",
      "text": "The rephrased sentence variation",
      "bengaliMeaning": "উক্ত প্যারাফ্রেজ বাক্যের নির্ভুল বাংলা অর্থ",
      "explanation": "When or why to use this paraphrased phrasing"
    }
  ],
  "errors": [
    {
      "type": "Grammar / Tense / Subject-Verb / Preposition / Article / Spelling / Punctuation",
      "incorrect": "the wrong word or phrase",
      "correction": "the corrected word or phrase",
      "explanation": "Why this was wrong and how to fix it in concise English",
      "bengaliExplanation": "সহজ বাংলায় কারণ ও নিয়মের ব্যাখ্যা"
    }
  ],
  "improvedAlternative": "A natural, fluent way native speakers express this thought",
  "formalAlternative": "Polished formal phrasing for exams, business, or official emails",
  "casualAlternative": "Natural casual/spoken phrasing for daily conversations",
  "grammarRuleTips": "A golden rule or memory trick to help the student avoid making this mistake again",
  "keyVocabulary": [
    {
      "word": "important word from sentence",
      "partOfSpeech": "verb / noun / adjective / adverb",
      "meaning": "English definition",
      "bengaliMeaning": "বাংলা অর্থ"
    }
  ]
}`;

        // Supported models in priority order
        const candidateModels = ['gemini-3-flash-preview', 'gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-flash-latest'];
        let geminiResponse = null;
        let selectedModel = candidateModels[0];

        for (const model of candidateModels) {
            try {
                const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
                const resCall = await fetch(geminiUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        contents: [
                            {
                                role: "user",
                                parts: [{ text: prompt }]
                            }
                        ],
                        generationConfig: {
                            temperature: 0.1,
                            responseMimeType: "application/json"
                        }
                    })
                });

                if (resCall.ok) {
                    geminiResponse = resCall;
                    selectedModel = model;
                    break;
                } else {
                    const errStatus = resCall.status;
                    const errBody = await resCall.text();
                    console.warn(`Model ${model} returned status ${errStatus}: ${errBody.slice(0, 150)}`);
                }
            } catch (err) {
                console.warn(`Error trying model ${model}:`, err.message);
            }
        }

        if (!geminiResponse || !geminiResponse.ok) {
            console.error("All Gemini candidate models failed. Returning fallback analysis.");
            const fallbackResult = generateFallbackAnalysis(trimmedSentence);
            return res.json({
                success: true,
                data: fallbackResult,
                warning: "Gemini AI generation was temporarily unavailable. Returned fallback result.",
                remainingQuota: req.remainingQuota
            });
        }

        const data = await geminiResponse.json();
        const responseText = data?.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!responseText) {
            throw new Error("No response generated by Gemini model");
        }

        const parsedResult = JSON.parse(responseText);

        res.json({
            success: true,
            data: parsedResult,
            remainingQuota: req.remainingQuota,
            clientIp: req.userIp
        });

    } catch (error) {
        console.error("Error in sentence checker:", error);
        res.status(500).json({
            success: false,
            message: "An error occurred while analyzing the sentence. Please try again.",
            error: error.message
        });
    }
});

app.get('/', (req, res) => {
    res.send('English Window API Server is running!')
})

app.listen(port, () => {
    console.log(`Example app listening on port ${port}`)
})