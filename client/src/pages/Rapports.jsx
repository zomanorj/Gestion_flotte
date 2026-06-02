import React, { useState } from 'react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { Search, Loader2, FileDown, Table2 } from 'lucide-react';
import api from '../services/api';

const formatDate   = (d) => d ? new Date(d).toLocaleDateString('fr-FR') : '—';
const formatAriary = (n) => n ? new Intl.NumberFormat('fr-FR').format(Math.round(n)) : '0';

export default function Rapports() {
  const [dateDebut,   setDateDebut]   = useState('');
  const [dateFin,     setDateFin]     = useState('');
  const [missions,    setMissions]    = useState([]);
  const [chargement,  setChargement]  = useState(false);
  const [genere,      setGenere]      = useState(false);

  const genererRapport = async () => {
    setChargement(true);
    try {
      const params = { statut: 'terminee' };
      if (dateDebut) params.debut = dateDebut;
      if (dateFin)   params.fin   = dateFin;
      const { data } = await api.get('/missions', { params });
      setMissions(data);
      setGenere(true);
    } catch {
      alert('Erreur lors de la génération du rapport');
    } finally {
      setChargement(false);
    }
  };

  const totalKm   = missions.reduce((s, m) => s + parseFloat(m.distance_km   || 0), 0);
  const totalCout = missions.reduce((s, m) => s + parseFloat(m.cout_carburant || 0), 0);

  const exporterPDF = () => {
    const doc = new jsPDF({ orientation: 'landscape' });
    doc.setFontSize(16);
    doc.setTextColor(30, 64, 175);
    doc.text('Rapport de Missions — FlotteApp Madagascar', 14, 18);
    doc.setFontSize(10);
    doc.setTextColor(100);
    const periode = dateDebut || dateFin
      ? `Période : ${dateDebut ? formatDate(dateDebut) : 'début'} → ${dateFin ? formatDate(dateFin) : 'fin'}`
      : 'Toutes les missions terminées';
    doc.text(periode, 14, 26);
    doc.text(`Généré le ${new Date().toLocaleDateString('fr-FR')}`, 14, 32);

    const lignes = missions.map((m) => [
      m.titre, m.immatriculation, `${m.chauffeur_prenom} ${m.chauffeur_nom}`,
      `${m.lieu_depart} → ${m.lieu_destination}`, `${m.distance_km} km`,
      formatAriary(m.cout_carburant) + ' Ar', formatDate(m.date_depart)
    ]);
    lignes.push([
      { content: `TOTAL — ${missions.length} mission(s)`, styles: { fontStyle: 'bold' } },
      '', '', '',
      { content: `${totalKm.toFixed(1)} km`, styles: { fontStyle: 'bold' } },
      { content: formatAriary(totalCout) + ' Ar', styles: { fontStyle: 'bold' } },
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
    doc.save(`rapport_missions_${new Date().toISOString().slice(0, 10)}.pdf`);
  };

  const exporterExcel = () => {
    const lignes = missions.map((m) => ({
      'Mission':             m.titre,
      'Véhicule':            m.immatriculation,
      'Chauffeur':           `${m.chauffeur_prenom} ${m.chauffeur_nom}`,
      'Départ':              m.lieu_depart,
      'Destination':         m.lieu_destination,
      'Distance (km)':       parseFloat(m.distance_km),
      'Coût carburant (Ar)': parseFloat(m.cout_carburant) || 0,
      'Date de départ':      formatDate(m.date_depart),
      'Date de retour':      formatDate(m.date_retour_reelle)
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
    XLSX.writeFile(wb, `rapport_missions_${new Date().toISOString().slice(0, 10)}.xlsx`);
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
                <button onClick={exporterPDF}
                        className="btn btn-danger btn-sm d-flex align-items-center gap-2">
                  <FileDown size={16} /> Exporter PDF
                </button>
                <button onClick={exporterExcel}
                        className="btn btn-success btn-sm d-flex align-items-center gap-2">
                  <Table2 size={16} /> Exporter Excel
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
                        <td className="px-3 py-2 text-gray-600">{m.distance_km} km</td>
                        <td className="px-3 py-2 text-primary fw-medium">{formatAriary(m.cout_carburant)} Ar</td>
                        <td className="px-3 py-2 text-gray-600">{formatDate(m.date_depart)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="table-primary border-top border-primary">
                    <tr>
                      <td colSpan={4} className="px-3 py-2 fw-bold text-dark">Total — {missions.length} mission(s)</td>
                      <td className="px-3 py-2 fw-bold text-dark">{totalKm.toFixed(1)} km</td>
                      <td className="px-3 py-2 fw-bold text-primary">{formatAriary(totalCout)} Ar</td>
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
