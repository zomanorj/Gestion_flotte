// Page rapports — filtrage des missions + export PDF et Excel
import React, { useState } from 'react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { Search, Loader2, FileDown, Table2 } from 'lucide-react';
import api from '../services/api';

const formatDate = (d) => d ? new Date(d).toLocaleDateString('fr-FR') : '—';
const formatAriary = (n) => n ? new Intl.NumberFormat('fr-FR').format(Math.round(n)) : '0';

export default function Rapports() {
  const [dateDebut,   setDateDebut]   = useState('');
  const [dateFin,     setDateFin]     = useState('');
  const [missions,    setMissions]    = useState([]);
  const [chargement,  setChargement]  = useState(false);
  const [genere,      setGenere]      = useState(false);

  /** Récupère les missions terminées sur la période sélectionnée */
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

  // Calcul des totaux pour la ligne de résumé
  const totalKm    = missions.reduce((s, m) => s + parseFloat(m.distance_km   || 0), 0);
  const totalCout  = missions.reduce((s, m) => s + parseFloat(m.cout_carburant || 0), 0);

  /**
   * Exporte le rapport en PDF avec jsPDF + autotable.
   * Génère un tableau formaté avec en-tête et ligne de totaux.
   */
  const exporterPDF = () => {
    const doc = new jsPDF({ orientation: 'landscape' });

    // En-tête du document
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
      m.titre,
      m.immatriculation,
      `${m.chauffeur_prenom} ${m.chauffeur_nom}`,
      `${m.lieu_depart} → ${m.lieu_destination}`,
      `${m.distance_km} km`,
      formatAriary(m.cout_carburant) + ' Ar',
      formatDate(m.date_depart)
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

  /**
   * Exporte le rapport en fichier Excel avec SheetJS.
   */
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
      'Mission':             `TOTAL (${missions.length} missions)`,
      'Véhicule':            '',
      'Chauffeur':           '',
      'Départ':              '',
      'Destination':         '',
      'Distance (km)':       parseFloat(totalKm.toFixed(2)),
      'Coût carburant (Ar)': parseFloat(totalCout.toFixed(2)),
      'Date de départ':      '',
      'Date de retour':      ''
    });

    const ws = XLSX.utils.json_to_sheet(lignes);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Rapport');
    XLSX.writeFile(wb, `rapport_missions_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  return (
    <div className="space-y-6">
      {/* Sélecteur de période */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6">
        <h3 className="font-semibold text-gray-800 mb-4">Paramètres du rapport</h3>
        <div className="flex flex-wrap gap-4 items-end">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Date de début</label>
            <input type="date" value={dateDebut} onChange={(e) => setDateDebut(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Date de fin</label>
            <input type="date" value={dateFin} onChange={(e) => setDateFin(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <button
            onClick={genererRapport}
            disabled={chargement}
            className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white font-medium rounded-xl
                       hover:bg-blue-700 disabled:opacity-60"
          >
            {chargement ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Chargement…</>
            ) : (
              <><Search className="w-4 h-4" /> Générer le rapport</>
            )}
          </button>
        </div>
        <p className="text-xs text-gray-400 mt-2">
          Sans filtre de date : toutes les missions terminées sont incluses.
        </p>
      </div>

      {/* Résultats */}
      {genere && (
        <>
          {/* Boutons d'export */}
          <div className="flex flex-wrap gap-3 items-center">
            <span className="text-sm text-gray-600">
              <strong>{missions.length}</strong> mission(s) trouvée(s)
            </span>
            <div className="flex-1" />
            {missions.length > 0 && (
              <>
                <button
                  onClick={exporterPDF}
                  className="flex items-center gap-2 px-5 py-2 bg-red-600 text-white text-sm font-medium
                             rounded-xl hover:bg-red-700 transition-colors"
                >
                  <FileDown className="w-4 h-4" /> Exporter PDF
                </button>
                <button
                  onClick={exporterExcel}
                  className="flex items-center gap-2 px-5 py-2 bg-green-600 text-white text-sm font-medium
                             rounded-xl hover:bg-green-700 transition-colors"
                >
                  <Table2 className="w-4 h-4" /> Exporter Excel
                </button>
              </>
            )}
          </div>

          {/* Tableau */}
          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
            {missions.length === 0 ? (
              <p className="text-center text-gray-400 py-12">
                Aucune mission terminée sur cette période
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      {['Mission', 'Véhicule', 'Chauffeur', 'Trajet', 'Distance', 'Coût carburant', 'Date'].map((h) => (
                        <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {missions.map((m) => (
                      <tr key={m.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-medium text-gray-900 max-w-[180px] truncate">{m.titre}</td>
                        <td className="px-4 py-3 text-gray-600 font-mono text-xs">{m.immatriculation}</td>
                        <td className="px-4 py-3 text-gray-600">{m.chauffeur_prenom} {m.chauffeur_nom}</td>
                        <td className="px-4 py-3 text-gray-600 text-xs">
                          {m.lieu_depart} → {m.lieu_destination}
                        </td>
                        <td className="px-4 py-3 text-gray-600">{m.distance_km} km</td>
                        <td className="px-4 py-3 text-blue-700 font-medium">
                          {formatAriary(m.cout_carburant)} Ar
                        </td>
                        <td className="px-4 py-3 text-gray-600">{formatDate(m.date_depart)}</td>
                      </tr>
                    ))}
                  </tbody>

                  {/* Ligne de totaux */}
                  <tfoot className="bg-blue-50 border-t-2 border-blue-200">
                    <tr>
                      <td colSpan={4} className="px-4 py-3 font-bold text-gray-900">
                        Total — {missions.length} mission(s)
                      </td>
                      <td className="px-4 py-3 font-bold text-gray-900">
                        {totalKm.toFixed(1)} km
                      </td>
                      <td className="px-4 py-3 font-bold text-blue-700">
                        {formatAriary(totalCout)} Ar
                      </td>
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
