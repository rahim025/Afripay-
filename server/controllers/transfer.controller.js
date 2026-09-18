const { getSupabase } = require('../config/supabase');

// Taux fictifs (valeur approximative d'1 unité de chaque devise, en USD)
// — à remplacer par une vraie API de taux de change en production.
const VALEUR_USD = {
  XOF: 1 / 600, XAF: 1 / 600,
  NGN: 1 / 1500, GHS: 1 / 15, KES: 1 / 130, UGX: 1 / 3700, TZS: 1 / 2500,
  RWF: 1 / 1300, ETB: 1 / 120, CDF: 1 / 2800, ZAR: 1 / 18, ZMW: 1 / 26,
  MWK: 1 / 1700, BWP: 1 / 13.5, NAD: 1 / 18, MZN: 1 / 64, AOA: 1 / 900,
  EGP: 1 / 49, MAD: 1 / 10, DZD: 1 / 135, TND: 1 / 3.1,
  USD: 1, EUR: 1.08, GBP: 1.27, CAD: 0.73,
};

function getTaux(deviseSource, deviseCible) {
  const src = VALEUR_USD[deviseSource];
  const dst = VALEUR_USD[deviseCible];
  if (!src || !dst) return 1; // devise inconnue : pas de conversion
  return src / dst;
}

function formatTransaction(t) {
  return {
    id: t.id,
    expediteur: t.expediteur_id,
    destinataire: t.destinataire_id,
    montantEnvoye: t.montant_envoye,
    deviseEnvoyee: t.devise_envoyee,
    montantRecu: t.montant_recu,
    deviseRecue: t.devise_recue,
    tauxApplique: t.taux_applique,
    statut: t.statut,
    createdAt: t.created_at,
  };
}

async function creerTransfert(req, res, next) {
  try {
    const supabase = getSupabase();
    const { destinataireId, montant, deviseCible } = req.body;
    const expediteurId = req.userId;

    const { data: expediteur, error: errExp } = await supabase
      .from('users')
      .select('*')
      .eq('id', expediteurId)
      .maybeSingle();
    if (errExp) throw errExp;

    const { data: destinataire, error: errDest } = await supabase
      .from('users')
      .select('*')
      .eq('id', destinataireId)
      .maybeSingle();
    if (errDest) throw errDest;

    if (!expediteur || !destinataire) {
      return res.status(404).json({ error: 'Utilisateur introuvable' });
    }

    if (Number(expediteur.solde) < Number(montant)) {
      return res.status(400).json({ error: 'Solde insuffisant' });
    }

    const taux = getTaux(expediteur.devise, deviseCible);
    const montantRecu = montant * taux;

    const { data: transaction, error: errTx } = await supabase
      .from('transactions')
      .insert({
        expediteur_id: expediteur.id,
        destinataire_id: destinataire.id,
        montant_envoye: montant,
        devise_envoyee: expediteur.devise,
        montant_recu: montantRecu,
        devise_recue: deviseCible,
        taux_applique: taux,
        statut: 'complete',
      })
      .select()
      .single();
    if (errTx) throw errTx;

    // Note : comme dans la version précédente, ces deux mises à jour ne sont
    // pas exécutées dans une transaction SQL atomique. Pour une vraie mise en
    // production, ceci devrait être fait via une fonction Postgres (RPC)
    // exécutant débit + crédit + insertion dans une seule transaction.
    const { error: errMajExp } = await supabase
      .from('users')
      .update({ solde: Number(expediteur.solde) - Number(montant) })
      .eq('id', expediteur.id);
    if (errMajExp) throw errMajExp;

    const { error: errMajDest } = await supabase
      .from('users')
      .update({ solde: Number(destinataire.solde) + Number(montantRecu) })
      .eq('id', destinataire.id);
    if (errMajDest) throw errMajDest;

    res.status(201).json({ transaction: formatTransaction(transaction) });
  } catch (err) {
    next(err);
  }
}

async function listerTransferts(req, res, next) {
  try {
    const supabase = getSupabase();

    const { data: transactions, error } = await supabase
      .from('transactions')
      .select('*')
      .or(`expediteur_id.eq.${req.userId},destinataire_id.eq.${req.userId}`)
      .order('created_at', { ascending: false });
    if (error) throw error;

    res.json({ transactions: transactions.map(formatTransaction) });
  } catch (err) {
    next(err);
  }
}

module.exports = { creerTransfert, listerTransferts };
