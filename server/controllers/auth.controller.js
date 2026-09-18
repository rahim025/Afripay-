const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { getSupabase } = require('../config/supabase');

function generateToken(userId) {
  return jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: '7d' });
}

function genererCode() {
  return String(Math.floor(100000 + Math.random() * 900000)); // code à 6 chiffres
}

function toPublicUser(user) {
  return { id: user.id, nom: user.nom, email: user.email, pays: user.pays, devise: user.devise };
}

async function inscription(req, res, next) {
  try {
    const supabase = getSupabase();
    const { nom, email, motDePasse, pays, devise } = req.body;

    if (!nom || !email || !motDePasse || !pays) {
      return res.status(400).json({ error: 'Champs manquants' });
    }

    const emailNormalise = email.toLowerCase().trim();

    const { data: existant, error: errExistant } = await supabase
      .from('users')
      .select('id')
      .eq('email', emailNormalise)
      .maybeSingle();
    if (errExistant) throw errExistant;
    if (existant) {
      return res.status(409).json({ error: 'Un compte existe déjà avec cet email' });
    }

    const hash = await bcrypt.hash(motDePasse, 10);

    const { data: user, error: errCreate } = await supabase
      .from('users')
      .insert({
        nom,
        email: emailNormalise,
        mot_de_passe: hash,
        pays,
        devise: devise || 'XOF',
        verifie: true, // pas de service SMS/email branché : compte actif immédiatement
      })
      .select()
      .single();
    if (errCreate) throw errCreate;

    const token = generateToken(user.id);
    res.status(201).json({ token, user: toPublicUser(user) });
  } catch (err) {
    next(err);
  }
}

async function verifierCompte(req, res, next) {
  try {
    const supabase = getSupabase();
    const { email, code } = req.body;

    if (!email || !code) {
      return res.status(400).json({ error: 'Email et code requis' });
    }

    const { data: user, error: errFind } = await supabase
      .from('users')
      .select('*')
      .eq('email', email.toLowerCase().trim())
      .maybeSingle();
    if (errFind) throw errFind;
    if (!user) {
      return res.status(404).json({ error: 'Compte introuvable' });
    }

    if (user.verifie) {
      return res.status(400).json({ error: 'Ce compte est déjà vérifié' });
    }

    if (!user.code_verification || user.code_verification !== code) {
      return res.status(400).json({ error: 'Code invalide' });
    }

    if (!user.code_verification_expire || new Date(user.code_verification_expire) < new Date()) {
      return res.status(400).json({ error: 'Code expiré, demandez-en un nouveau' });
    }

    const { data: userMaj, error: errMaj } = await supabase
      .from('users')
      .update({ verifie: true, code_verification: null, code_verification_expire: null })
      .eq('id', user.id)
      .select()
      .single();
    if (errMaj) throw errMaj;

    const token = generateToken(userMaj.id);
    res.json({ token, user: toPublicUser(userMaj) });
  } catch (err) {
    next(err);
  }
}

async function renvoyerCode(req, res, next) {
  try {
    const supabase = getSupabase();
    const { email } = req.body;

    const { data: user, error: errFind } = await supabase
      .from('users')
      .select('*')
      .eq('email', email ? email.toLowerCase().trim() : '')
      .maybeSingle();
    if (errFind) throw errFind;
    if (!user) {
      return res.status(404).json({ error: 'Compte introuvable' });
    }
    if (user.verifie) {
      return res.status(400).json({ error: 'Ce compte est déjà vérifié' });
    }

    const code = genererCode();
    const expire = new Date(Date.now() + 15 * 60 * 1000).toISOString();

    const { error: errMaj } = await supabase
      .from('users')
      .update({ code_verification: code, code_verification_expire: expire })
      .eq('id', user.id);
    if (errMaj) throw errMaj;

    console.log(`📩 Nouveau code de vérification pour ${user.email} : ${code}`);
    res.json({ message: 'Un nouveau code a été envoyé.' });
  } catch (err) {
    next(err);
  }
}

async function connexion(req, res, next) {
  try {
    const supabase = getSupabase();
    const { email, motDePasse } = req.body;

    const { data: user, error: errFind } = await supabase
      .from('users')
      .select('*')
      .eq('email', email ? email.toLowerCase().trim() : '')
      .maybeSingle();
    if (errFind) throw errFind;
    if (!user) {
      return res.status(401).json({ error: 'Identifiants invalides' });
    }

    const valide = await bcrypt.compare(motDePasse, user.mot_de_passe);
    if (!valide) {
      return res.status(401).json({ error: 'Identifiants invalides' });
    }

    if (!user.verifie) {
      return res.status(403).json({ error: 'Compte non vérifié', code: 'NON_VERIFIE', email: user.email });
    }

    const token = generateToken(user.id);
    res.json({ token, user: toPublicUser(user) });
  } catch (err) {
    next(err);
  }
}

module.exports = { inscription, connexion, verifierCompte, renvoyerCode };
