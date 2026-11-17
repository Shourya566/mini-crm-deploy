import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import User from '../models/user.model.js';

// Serialize user for the session
passport.serializeUser((user, done) => {
  console.log('Serializing user:', user);
  done(null, user.id);
});

// Deserialize user from the session
passport.deserializeUser(async (id, done) => {
  console.log('Deserializing user ID:', id);
  try {
    const user = await User.findById(id);
    if (!user) {
      console.log('User not found during deserialization');
      return done(null, false);
    }
    console.log('Deserialized user:', user);
    done(null, user);
  } catch (error) {
    console.error('Error deserializing user:', error);
    done(error, null);
  }
});

// Google OAuth Strategy (only registered if credentials are configured)
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  passport.use(new GoogleStrategy({
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: process.env.GOOGLE_CALLBACK_URL || '/auth/google/callback',
      proxy: true
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        // Find existing user
        let user = await User.findOne({ googleId: profile.id });
        
        if (!user) {
          // Create new user if doesn't exist
          user = await User.create({
            googleId: profile.id,
            email: profile.emails?.[0]?.value,
            displayName: profile.displayName,
            firstName: profile.name?.givenName,
            lastName: profile.name?.familyName,
            profilePicture: profile.photos?.[0]?.value
          });
        } else {
          // Update existing user
          user.displayName = profile.displayName;
          user.firstName = profile.name?.givenName;
          user.lastName = profile.name?.familyName;
          user.profilePicture = profile.photos?.[0]?.value;
          user.lastLogin = new Date();
          await user.save();
        }
        
        return done(null, user);
      } catch (error) {
        console.error('Error in Google OAuth strategy:', error);
        return done(error, null);
      }
    }
  ));
} else {
  console.warn('Google OAuth credentials not configured; Google login strategy is disabled.');
} 