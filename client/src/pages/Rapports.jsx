import { useEffect, useState } from 'react';
import { Search, FileDown, Table2, FileText } from 'lucide-react';
import { useMissions } from '../requetes';
import { dateDuJour, formaterDate, formaterKm, formaterMontant, pourPdf } from '../utils/format';
import Trajet from '../components/ui/Trajet';
import EnTetePage from '../components/ui/EnTetePage';
import EtatVide from '../components/ui/EtatVide';


export default function Rapports() {
  const [dateDebut,   setDateDebut]   = useState('');
  const [dateFin,     setDateFin]     = useState('');
  // Filtres du dernier rapport demandé (null : aucun rapport encore généré)
  const [filtres,     setFiltres]     = useState(null);
  const rapport = useMissions(filtres ?? {}, { enabled: !!filtres });
  const missions   = rapport.data ?? [];
  const chargement = rapport.isFetching;
  const genere     = !!filtres && rapport.isSuccess;
  // Bibliothèques d'export (jsPDF, write-excel-file) téléchargées seulement au premier export
  const [exportEnCours, setExportEnCours] = useState(null); // 'pdf' | 'excel' | null

  const exporter = async (format, fonction) => {
    setExportEnCours(format);
    try {
      await fonction();
    } catch {
      alert("L'export n'a pas pu être généré. Vérifiez votre connexion et réessayez.");
    } finally {
      setExportEnCours(null);
    }
  };

  useEffect(() => {
    if (rapport.isError) alert('Erreur lors de la génération du rapport');
  }, [rapport.isError]);

  const genererRapport = () => {
    const demande = { statut: 'terminee', debut: dateDebut, fin: dateFin };
    // Mêmes filtres : relecture forcée pour inclure les missions terminées depuis
    if (JSON.stringify(demande) === JSON.stringify(filtres)) rapport.refetch();
    else setFiltres(demande);
  };

  const totalKm   = missions.reduce((s, m) => s + parseFloat(m.distance_km   || 0), 0);
  const totalCout = missions.reduce((s, m) => s + parseFloat(m.cout_carburant || 0), 0);

  const exporterPDF = async () => {
    const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
      import('jspdf'), import('jspdf-autotable')
    ]);
    const doc = new jsPDF({ orientation: 'landscape' });
    doc.setFontSize(16);
    doc.setTextColor(30, 64, 175);
    doc.text('Rapport de Missions — TransiFlow Madagascar', 14, 18);
    doc.setFontSize(10);
    doc.setTextColor(100);
    const periode = dateDebut || dateFin
      ? `Période : ${dateDebut ? formaterDate(dateDebut) : 'début'} → ${dateFin ? formaterDate(dateFin) : 'fin'}`
      : 'Toutes les missions terminées';
    doc.text(pourPdf(periode), 14, 26);
    doc.text(`Généré le ${formaterDate(new Date())}`, 14, 32);

    // Les polices standard de jsPDF n'ont ni la flèche ni les espaces fines des nombres
    const lignes = missions.map((m) => [
      m.titre, m.immatriculation, `${m.chauffeur_prenom} ${m.chauffeur_nom}`,
      `${m.lieu_depart} → ${m.lieu_destination}`, formaterKm(m.distance_km, 1),
      formaterMontant(m.cout_carburant, '0 Ar'), formaterDate(m.date_depart)
    ].map(pourPdf));
    lignes.push([
      { content: `TOTAL — ${missions.length} mission(s)`, styles: { fontStyle: 'bold' } },
      '', '', '',
      { content: pourPdf(formaterKm(totalKm, 1)), styles: { fontStyle: 'bold' } },
      { content: pourPdf(formaterMontant(totalCout)), styles: { fontStyle: 'bold' } },
      ''
    ]);

    autoTable(doc, {
      startY: 38,
      head: [['Mission', 'Véhicule', 'Chauffeur', 'Trajet', 'Distance', 'Coût carburant', 'Date départ']],
      body: lignes,
      headStyles: { fillColor: [30, 64, 175], fontSize: 9 },
      bodyStyles: { fontSize: 8 },
      alternateRowStyles: { fillColor: [239, 246, 255] },
      margin: { left: 14, right: 14 }
    });
    doc.save(`rapport_missions_${dateDuJour()}.pdf`);
  };

  const exporterExcel = async () => {
    const { default: writeExcelFile } = await import('write-excel-file/browser');
    const lignes = missions.map((m) => ({
      mission:     m.titre,
      vehicule:    m.immatriculation,
      chauffeur:   `${m.chauffeur_prenom} ${m.chauffeur_nom}`,
      depart:      m.lieu_depart,
      destination: m.lieu_destination,
      distance:    parseFloat(m.distance_km) || 0,
      cout:        parseFloat(m.cout_carburant) || 0,
      dateDepart:  formaterDate(m.date_depart),
      dateRetour:  formaterDate(m.date_retour_reelle)
    }));
    // Ligne de total en gras, en bas du tableau
    lignes.push({
      mission: `TOTAL (${missions.length} missions)`, distance: totalKm, cout: totalCout, total: true
    });

    const entete = (texte) => ({ value: texte, fontWeight: 'bold' });
    const texte = (cle) => (l) => ({ value: l[cle] ?? null, fontWeight: l.total ? 'bold' : undefined });
    const nombre = (cle, format) => (l) => ({ value: l[cle], type: Number, format, fontWeight: l.total ? 'bold' : undefined });
    const colonnes = [
      { header: entete('Mission'),             cell: texte('mission'),              width: 30 },
      { header: entete('Véhicule'),            cell: texte('vehicule'),             width: 14 },
      { header: entete('Chauffeur'),           cell: texte('chauffeur'),            width: 22 },
      { header: entete('Départ'),              cell: texte('depart'),               width: 18 },
      { header: entete('Destination'),         cell: texte('destination'),          width: 18 },
      { header: entete('Distance (km)'),       cell: nombre('distance', '#,##0.0'), width: 14 },
      { header: entete('Coût carburant (Ar)'), cell: nombre('cout', '#,##0'),       width: 20 },
      { header: entete('Date de départ'),      cell: texte('dateDepart'),           width: 16 },
      { header: entete('Date de retour'),      cell: texte('dateRetour'),           width: 16 }
    ];
    await writeExcelFile(lignes, { columns: colonnes, sheet: 'Rapport', stickyRowsCount: 1 })
      .toFile(`rapport_missions_${dateDuJour()}.xlsx`);
  };

  return (
    <div className="d-flex flex-column gap-4">
      <EnTetePage titre="Rapports" description="Missions terminées sur une période, exportables en PDF ou Excel" />

      <div className="card">
        <div className="card-body">
          <div className="d-flex flex-wrap gap-3 align-items-end">
            <div>
              <label htmlFor="rapport-debut" className="form-label">Du</label>
              <input id="rapport-debut" type="date" value={dateDebut} onChange={(e) => setDateDebut(e.target.value)} className="form-control" />
            </div>
            <div>
              <label htmlFor="rapport-fin" className="form-label">Au</label>
              <input id="rapport-fin" type="date" value={dateFin} onChange={(e) => setDateFin(e.target.value)} className="form-control" />
            </div>
            <button onClick={genererRapport} disabled={chargement} className="btn btn-primary">
              {chargement ? <span className="spinner-border spinner-border-sm" role="status" /> : <Search size={16} />}
              Générer le rapport
            </button>
          </div>
          <p className="form-text mb-0 mt-2">Sans dates, toutes les missions terminées sont incluses.</p>
        </div>
      </div>

      {!genere && !chargement && (
        <div className="card">
          <EtatVide Icone={FileText} titre="Aucun rapport généré"
                    description="Choisissez une période puis générez le rapport pour afficher et exporter les missions terminées." />
        </div>
      )}

      {genere && (
        <>
          <div className="d-flex flex-wrap gap-3 align-items-center">
            <p className="mb-0 text-gray-700">
              <strong className="text-dark">{missions.length}</strong> mission(s) trouvée(s)
              {missions.length > 0 && <> · {formaterKm(totalKm, 1)} · {formaterMontant(totalCout)} de carburant</>}
            </p>
            <div className="flex-grow-1" />
            {missions.length > 0 && (
              <div className="d-flex gap-2">
                <button onClick={() => exporter('pdf', exporterPDF)} disabled={exportEnCours !== null} className="btn btn-outline-secondary btn-sm">
                  {exportEnCours === 'pdf' ? <span className="spinner-border spinner-border-sm" role="status" aria-label="Préparation de l'export" /> : <FileDown size={15} />}
                  Exporter PDF
                </button>
                <button onClick={() => exporter('excel', exporterExcel)} disabled={exportEnCours !== null} className="btn btn-outline-secondary btn-sm">
                  {exportEnCours === 'excel' ? <span className="spinner-border spinner-border-sm" role="status" aria-label="Préparation de l'export" /> : <Table2 size={15} />}
                  Exporter Excel
                </button>
              </div>
            )}
          </div>

          <div className="card carte-tableau">
            {missions.length === 0 ? (
              <EtatVide Icone={FileText} titre="Aucune mission terminée" description="Aucune mission terminée sur cette période." />
            ) : (
              <div className="table-responsive">
                <table className="table table-hover align-middle">
                  <thead>
                    <tr><th>Mission</th><th>Camion et chauffeur</th><th>Date</th><th className="text-end">Distance</th><th className="text-end">Coût carburant</th></tr>
                  </thead>
                  <tbody>
                    {missions.map((m) => (
                      <tr key={m.id}>
                        <td style={{ maxWidth: '20rem' }}>
                          <p className="fw-medium mb-0 text-truncate">{m.titre}</p>
                          <p className="small text-muted mb-0"><Trajet depart={m.lieu_depart} destination={m.lieu_destination} /></p>
                        </td>
                        <td>
                          <p className="mb-0 immatriculation">{m.immatriculation}</p>
                          <p className="small text-muted mb-0">{m.chauffeur_prenom} {m.chauffeur_nom}</p>
                        </td>
                        <td className="text-gray-700 text-nowrap">{formaterDate(m.date_depart)}</td>
                        <td className="text-end text-nowrap">{formaterKm(m.distance_km, 1)}</td>
                        <td className="text-end text-nowrap">{formaterMontant(m.cout_carburant, '0 Ar')}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="ligne-total">
                      <td colSpan={3}>Total, {missions.length} mission(s)</td>
                      <td className="text-end text-nowrap">{formaterKm(totalKm, 1)}</td>
                      <td className="text-end text-nowrap">{formaterMontant(totalCout)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
