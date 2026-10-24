import OpenAI from 'openai';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';

dotenv.config();

// Lazy OpenAI client initialization
let openaiClient = null;
const getOpenAIClient = () => {
  if (!process.env.OPENAI_API_KEY) {
    return null;
  }
  if (!openaiClient) {
    openaiClient = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }
  return openaiClient;
};

// Rate limiter for AI endpoints
export const aiRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: { 
    error: 'Too many requests',
    details: 'Please try again later'
  }
});

// Validate OpenAI response
const validateOpenAIResponse = (completion) => {
  if (!completion?.choices?.[0]?.message?.content) {
    throw new Error('Invalid response from OpenAI');
  }

  try {
    return JSON.parse(completion.choices[0].message.content);
  } catch (error) {
    throw new Error('Failed to parse OpenAI response');
  }
};

// Handle OpenAI API errors
const handleOpenAIError = (error) => {
  console.error('OpenAI API Error:', error);

  if (error.response?.status === 429) {
    return {
      status: 429,
      error: 'Rate limit exceeded',
      details: 'Please try again later'
    };
  }

  if (error.response?.status === 401) {
    return {
      status: 401,
      error: 'Authentication error',
      details: 'Invalid API key'
    };
  }

  return {
    status: 500,
    error: 'AI service error',
    details: error.message || 'An unexpected error occurred'
  };
};

export const generateSegmentRules = async (req, res) => {
  try {
    const { prompt } = req.body;
    
    if (!prompt?.trim()) {
      return res.status(400).json({ 
        error: 'Invalid request',
        details: 'Prompt is required'
      });
    }

    const openai = getOpenAIClient();
    if (!openai) {
      return res.status(500).json({ 
        error: 'Configuration error',
        details: 'OpenAI API key is not configured'
      });
    }

    try {
      const completion = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [
          {
            role: "system",
            content: `You are a CRM expert that converts natural language descriptions into segment rules. 
            Output should be a JSON object with operator (AND/OR) and conditions array. 
            Each condition should have type (spend/visits/inactive/purchases/location), operator (>/</=/>=/<=/contains), and value.
            Example output: {"operator": "AND", "conditions": [{"type": "inactive", "operator": ">", "value": "180"}, {"type": "spend", "operator": ">", "value": "5000"}]}`
          },
          {
            role: "user",
            content: prompt
          }
        ],
        temperature: 0.7,
        max_tokens: 200
      });

      const rules = validateOpenAIResponse(completion);
      
      if (!rules.operator || !Array.isArray(rules.conditions)) {
        throw new Error('Invalid rules format generated');
      }

      res.json(rules);
    } catch (error) {
      const errorResponse = handleOpenAIError(error);
      res.status(errorResponse.status).json(errorResponse);
    }
  } catch (error) {
    console.error('Error generating segment rules:', error);
    res.status(500).json({ 
      error: 'Server error',
      details: 'An unexpected error occurred'
    });
  }
};

export const generateMessageSuggestions = async (req, res) => {
  try {
    const { objective, audience } = req.body;

    if (!objective?.trim() || !audience?.trim()) {
      return res.status(400).json({ 
        error: 'Invalid request',
        details: 'Both objective and audience are required'
      });
    }

    const openai = getOpenAIClient();
    // Check if OpenAI API key is configured
    if (!openai) {
      console.log('OpenAI API key not configured, using fallback templates');
      return res.json(getFallbackSuggestions(objective, audience));
    }

    try {
      console.log('Making OpenAI request for message suggestions...');
      
      const completion = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [
          {
            role: "system",
            content: `Generate 3 marketing message variants with different tones (professional, friendly, persuasive).
            Each message must include a subject line and body text.
            Format the response as a JSON array of objects with this exact structure:
            [
              {
                "tone": "professional",
                "subject": "Subject line here",
                "body": "Message body here"
              }
            ]`
          },
          {
            role: "user",
            content: `Campaign objective: ${objective}\nTarget audience: ${audience}`
          }
        ],
        temperature: 0.7,
        max_tokens: 1000,
        response_format: { type: "json_object" }
      });

      console.log('OpenAI response received');

      let suggestions;
      try {
        suggestions = JSON.parse(completion.choices[0]?.message?.content || '[]');
      } catch (parseError) {
        console.error('Failed to parse OpenAI response:', parseError);
        return res.json(getFallbackSuggestions(objective, audience));
      }

      if (!Array.isArray(suggestions) || suggestions.length === 0) {
        console.log('Invalid or empty suggestions from OpenAI, using fallback');
        return res.json(getFallbackSuggestions(objective, audience));
      }

      // Validate each suggestion has required fields
      const validSuggestions = suggestions.filter(suggestion => 
        suggestion?.tone && 
        suggestion?.subject && 
        suggestion?.body
      );

      if (validSuggestions.length === 0) {
        console.log('No valid suggestions from OpenAI, using fallback');
        return res.json(getFallbackSuggestions(objective, audience));
      }

      return res.json(validSuggestions);

    } catch (error) {
      console.error('OpenAI API error:', error);
      console.log('Using fallback suggestions due to API error');
      return res.json(getFallbackSuggestions(objective, audience));
    }
  } catch (error) {
    console.error('Server error:', error);
    return res.status(500).json({
      error: 'Server error',
      details: 'An unexpected error occurred'
    });
  }
};

// Fallback message suggestion templates
const getFallbackSuggestions = (objective, audience) => {
  const templates = [
    {
      tone: "professional",
      subject: `Important Update: ${truncate(objective, 30)}`,
      body: `Dear ${audience},\n\nWe are reaching out regarding ${objective}. Our team has prepared resources specifically designed for your needs.\n\nPlease review the attached information and contact us if you have any questions.\n\nBest regards,\nThe Team`
    },
    {
      tone: "friendly",
      subject: `Hey! Check out ${truncate(objective, 25)}`,
      body: `Hi there ${audience}!\n\nWe thought you might be interested in our latest ${objective}. We designed this with people like you in mind!\n\nLet us know what you think - we'd love to hear your feedback.\n\nCheers,\nThe Team`
    },
    {
      tone: "persuasive",
      subject: `Don't miss out: ${truncate(objective, 25)}`,
      body: `${audience},\n\nTime is running out to take advantage of our ${objective}. Many of our customers have already seen impressive results.\n\nAct now to secure your spot before this opportunity ends.\n\nLooking forward to your response,\nThe Team`
    }
  ];
  
  return templates;
};

// Helper function to truncate text
const truncate = (text, maxLength) => {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
};