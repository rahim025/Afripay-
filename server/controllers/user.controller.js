const { getSupabase } = require('../config/supabase');

function formatTransaction(t, userId) {
  return {
    id: t.id,
    sens: t.expediteur_id === userId ? 'envoye' : 'recu',
    montantEnvoye: t.montant_envoye,
    deviseEnvoyee: t.devise_envoyee,
    montantRecu: t.montant_recu,
    deviseRecue: t.devise_recue,
    statut: t.statut,
    date: t.created_at,
  };
}

async function moi(req, res, next) {
  try {
    const supabase = getSupabase();

    const { data: user, error: errUser } = await supabase
      .from('users')
      .select('*')
      .eq('id', req.userId)
      .maybeSingle();
    if (errUser) throw errUser;
    if (!user) return res.status(404).json({ error: 'Utilisateur introuvable' });

    const { data: transactions, error: errTx } = await supabase
      .from('transactions')
      .select('*')
      .or(`expediteur_id.eq.${user.id},destinataire_id.eq.${user.id}`)
      .order('created_at', { ascending: false })
      .limit(50);
    if (errTx) throw errTx;

    let totalEnvoye = 0;
    let totalRecu = 0;
    transactions.forEach((t) => {
      if (t.expediteur_id === user.id) totalEnvoye += Number(t.montant_envoye);
      if (t.destinataire_id === user.id) totalRecu += Number(t.montant_recu);
    });

    res.json({
      user: {
        id: user.id,
        nom: user.nom,
        email: user.email,
        telephone: user.telephone,
        pays: user.pays,
        devise: user.devise,
        solde: user.solde,
        createdAt: user.created_at,
      },
      stats: {
        totalEnvoye,
        totalRecu,
        nombreTransactions: transactions.length,
      },
      transactions: transactions.map((t) => formatTransaction(t, user.id)),
    });
  } catch (err) {
    next(err);
  }
}

// Recherche d'un destinataire par email, pour préparer un transfert
async function rechercher(req, res, next) {
  try {
    const supabase = getSupabase();
    const { email } = req.query;
    if (!email) return res.status(400).json({ error: 'Email requis' });

    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('email', email.toLowerCase().trim())
      .maybeSingle();
    if (error) throw error;
    if (!user) return res.status(404).json({ error: 'Aucun utilisateur avec cet email' });

    res.json({ user: { id: user.id, nom: user.nom, pays: user.pays, devise: user.devise } });
  } catch (err) {
    next(err);
  }
}

// Dépôt de démonstration — à remplacer par une vraie intégration de paiement
async function deposer(req, res, next) {
  try {
    const supabase = getSupabase();
    const { montant } = req.body;
    if (!montant || montant <= 0) {
      return res.status(400).json({ error: 'Montant invalide' });
    }

    const { data: user, error: errUser } = await supabase
      .from('users')
      .select('*')
      .eq('id', req.userId)
      .maybeSingle();
    if (errUser) throw errUser;
    if (!user) return res.status(404).json({ error: 'Utilisateur introuvable' });

    const nouveauSolde = Number(user.solde) + Number(montant);

    const { data: userMaj, error: errMaj } = await supabase
      .from('users')
      .update({ solde: nouveauSolde })
      .eq('id', user.id)
      .select('solde')
      .single();
    if (errMaj) throw errMaj;

    res.json({ message: 'Dépôt effectué (démonstration)', solde: userMaj.solde });
  } catch (err) {
    next(err);
  }
}

module.exports = { moi, rechercher, deposer };
