import { useEffect, useState } from 'react';
import { Search, FileDown, Table2 } from 'lucide-react';
import { useMissions } from '../requetes';
import { dateDuJour, formaterDate, formaterKm, formaterMontant, pourPdf } from '../utils/format';


export default function Rapports() {
  const [dateDebut,   setDateDebut]   = useState('');
  const [dateFin,     setDateFin]     = useState('');
  // Filtres du dernier rapport demandé (null : aucun rapport encore généré)
  const [filtres,     setFiltres]     = useState(null);
  const rapport = useMissions(filtres ?? {}, { enabled: !!filtres });
  const missions   = rapport.data ?? [];
  const chargement = rapport.isFetching;
  const genere     = !!filtres && rapport.isSuccess;
  // Bibliothèques d'export (jsPDF, xlsx : ~800 Ko) téléchargées seulement au premier export
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
    doc.text('Rapport de Missions — FlotteApp Madagascar', 14, 18);
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
    const XLSX = await import('xlsx');
    const lignes = missions.map((m) => ({
      'Mission':             m.titre,
      'Véhicule':            m.immatriculation,
      'Chauffeur':           `${m.chauffeur_prenom} ${m.chauffeur_nom}`,
      'Départ':              m.lieu_depart,
      'Destination':         m.lieu_destination,
      'Distance (km)':       parseFloat(m.distance_km),
      'Coût carburant (Ar)': parseFloat(m.cout_carburant) || 0,
      'Date de départ':      formaterDate(m.date_depart),
      'Date de retour':      formaterDate(m.date_retour_reelle)
    }));
    lignes.push({
      'Mission': `TOTAL (${missions.length} missions)`,
      'Véhicule': '', 'Chauffeur': '', 'Départ': '', 'Destination': '',
      'Distance (km)': parseFloat(totalKm.toFixed(2)),
      'Coût carburant (Ar)': parseFloat(totalCout.toFixed(2)),
      'Date de départ': '', 'Date de retour': ''
    });
    const ws = XLSX.utils.json_to_sheet(lignes);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Rapport');
    XLSX.writeFile(wb, `rapport_missions_${dateDuJour()}.xlsx`);
  };

  return (
    <div className="d-flex flex-column gap-4">

      {/* Paramètres */}
      <div className="card border rounded-3">
        <div className="card-body p-4">
          <h3 className="fw-semibold text-dark fs-6 mb-3">Paramètres du rapport</h3>
          <div className="d-flex flex-wrap gap-3 align-items-end">
            <div>
              <label className="form-label">Date de début</label>
              <input type="date" value={dateDebut} onChange={(e) => setDateDebut(e.target.value)}
                     className="form-control form-control-sm" />
            </div>
            <div>
              <label className="form-label">Date de fin</label>
              <input type="date" value={dateFin} onChange={(e) => setDateFin(e.target.value)}
                     className="form-control form-control-sm" />
            </div>
            <button onClick={genererRapport} disabled={chargement}
                    className="btn btn-primary d-flex align-items-center gap-2">
              {chargement
                ? <><span className="spinner-border spinner-border-sm" role="status" /> Chargement…</>
                : <><Search size={16} /> Générer le rapport</>
              }
            </button>
          </div>
          <p className="text-muted small mt-2 mb-0">
            Sans filtre de date : toutes les missions terminées sont incluses.
          </p>
        </div>
      </div>

      {/* Résultats */}
      {genere && (
        <>
          <div className="d-flex flex-wrap gap-3 align-items-center">
            <span className="small text-gray-600">
              <strong>{missions.length}</strong> mission(s) trouvée(s)
            </span>
            <div className="flex-grow-1" />
            {missions.length > 0 && (
              <>
                <button onClick={() => exporter('pdf', exporterPDF)} disabled={exportEnCours !== null}
                        className="btn btn-danger btn-sm d-flex align-items-center gap-2">
                  {exportEnCours === 'pdf' ? <span className="spinner-border spinner-border-sm" role="status" aria-label="Préparation de l'export" /> : <FileDown size={16} />}
                  Exporter PDF
                </button>
                <button onClick={() => exporter('excel', exporterExcel)} disabled={exportEnCours !== null}
                        className="btn btn-success btn-sm d-flex align-items-center gap-2">
                  {exportEnCours === 'excel' ? <span className="spinner-border spinner-border-sm" role="status" aria-label="Préparation de l'export" /> : <Table2 size={16} />}
                  Exporter Excel
                </button>
              </>
            )}
          </div>

          <div className="card border rounded-3 overflow-hidden">
            {missions.length === 0 ? (
              <p className="text-center text-muted py-5">Aucune mission terminée sur cette période</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="table table-sm table-hover mb-0">
                  <thead className="table-light">
                    <tr>
                      {['Mission', 'Véhicule', 'Chauffeur', 'Trajet', 'Distance', 'Coût carburant', 'Date'].map((h) => (
                        <th key={h} className="text-uppercase small fw-semibold text-muted px-3 py-2">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {missions.map((m) => (
                      <tr key={m.id}>
                        <td className="px-3 py-2 fw-medium text-dark text-truncate" style={{ maxWidth: '180px' }}>{m.titre}</td>
                        <td className="px-3 py-2 text-gray-600 font-monospace small">{m.immatriculation}</td>
                        <td className="px-3 py-2 text-gray-600">{m.chauffeur_prenom} {m.chauffeur_nom}</td>
                        <td className="px-3 py-2 text-gray-600 small">{m.lieu_depart} → {m.lieu_destination}</td>
                        <td className="px-3 py-2 text-gray-600">{formaterKm(m.distance_km, 1)}</td>
                        <td className="px-3 py-2 text-primary fw-medium">{formaterMontant(m.cout_carburant, '0 Ar')}</td>
                        <td className="px-3 py-2 text-gray-600">{formaterDate(m.date_depart)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="table-primary border-top border-primary">
                    <tr>
                      <td colSpan={4} className="px-3 py-2 fw-bold text-dark">Total — {missions.length} mission(s)</td>
                      <td className="px-3 py-2 fw-bold text-dark">{formaterKm(totalKm, 1)}</td>
                      <td className="px-3 py-2 fw-bold text-primary">{formaterMontant(totalCout)}</td>
                      <td />
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
