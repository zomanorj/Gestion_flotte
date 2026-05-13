// Page planning calendrier — vues mois/semaine/jour avec FullCalendar
import React, { useState, useRef } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin   from '@fullcalendar/daygrid';
import timeGridPlugin  from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import { Calendar, X, MapPin, Truck, User, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';

// Couleurs et libellés des statuts
const STATUT_CFG = {
  planifiee: { label: 'Planifiée',  cls: 'bg-yellow-100 text-yellow-700' },
  en_cours:  { label: 'En cours',   cls: 'bg-blue-100   text-blue-700'   },
  terminee:  { label: 'Terminée',   cls: 'bg-green-100  text-green-700'  },
  annulee:   { label: 'Annulée',    cls: 'bg-gray-100   text-gray-500'   }
};

const LEGENDE = [
  { couleur: '#f59e0b', label: 'Planifiée' },
  { couleur: '#3b82f6', label: 'En cours'  },
  { couleur: '#22c55e', label: 'Terminée'  },
  { couleur: '#9ca3af', label: 'Annulée'   }
];

export default function Planning() {
  const navigate   = useNavigate();
  const calendarRef = useRef(null);

  // Popup affiché au clic sur un événement
  const [popup,    setPopup]    = useState(null);
  const [popupPos, setPopupPos] = useState({ x: 0, y: 0 });

  /** Charge les événements depuis l'API */
  const chargerEvenements = async () => {
    const { data } = await api.get('/missions/planning');
    return data;
  };

  /** Clic sur un événement — affiche le popup de détail */
  const onEventClick = (info) => {
    const rect = info.el.getBoundingClientRect();
    setPopupPos({
      x: Math.min(rect.left, window.innerWidth - 320),
      y: rect.bottom + window.scrollY + 8
    });
    setPopup({
      id:    info.event.id,
      titre: info.event.title,
      ...info.event.extendedProps
    });
  };

  /** Clic sur une date — redirige vers /missions (création pré-remplie non implémentée) */
  const onDateClick = () => {
    navigate('/missions');
  };

  return (
    <div className="space-y-4">

      {/* En-tête */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-blue-100 rounded-xl p-2">
            <Calendar className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Planning des missions</h1>
            <p className="text-sm text-gray-500">Vue calendrier de toutes les missions</p>
          </div>
        </div>

        {/* Légende des couleurs */}
        <div className="flex items-center gap-4">
          {LEGENDE.map(({ couleur, label }) => (
            <div key={label} className="flex items-center gap-1.5 text-sm text-gray-600">
              <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: couleur }} />
              {label}
            </div>
          ))}
        </div>
      </div>

      {/* Calendrier */}
      <div className="bg-white rounded-2xl border border-gray-200 p-4 overflow-hidden">
        <FullCalendar
          ref={calendarRef}
          plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
          initialView="dayGridMonth"
          locale="fr"
          headerToolbar={{
            left:   'prev,next today',
            center: 'title',
            right:  'dayGridMonth,timeGridWeek,timeGridDay'
          }}
          buttonText={{
            today: "Aujourd'hui",
            month: 'Mois',
            week:  'Semaine',
            day:   'Jour'
          }}
          events={chargerEvenements}
          eventClick={onEventClick}
          dateClick={onDateClick}
          eventDisplay="block"
          dayMaxEvents={3}
          height="auto"
          eventClassNames="cursor-pointer"
        />
      </div>

      {/* Popup détail d'une mission */}
      {popup && (
        <>
          {/* Overlay transparent pour fermer */}
          <div className="fixed inset-0 z-40" onClick={() => setPopup(null)} />

          <div
            className="fixed z-50 bg-white rounded-2xl shadow-2xl border border-gray-200 w-80 p-5"
            style={{ left: popupPos.x, top: popupPos.y }}
          >
            <div className="flex items-start justify-between mb-3">
              <h3 className="font-bold text-gray-900 text-sm leading-tight pr-2">{popup.titre}</h3>
              <button onClick={() => setPopup(null)} className="text-gray-400 hover:text-gray-600 flex-shrink-0">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2 text-sm">
              {/* Statut */}
              <div>
                <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium
                  ${STATUT_CFG[popup.statut]?.cls || 'bg-gray-100 text-gray-600'}`}>
                  {STATUT_CFG[popup.statut]?.label || popup.statut}
                </span>
              </div>

              {/* Trajet */}
              <div className="flex items-center gap-2 text-gray-700">
                <MapPin className="w-4 h-4 text-gray-400 flex-shrink-0" />
                <span>{popup.lieu_depart}</span>
                <ArrowRight className="w-3 h-3 text-gray-400" />
                <span>{popup.lieu_destination}</span>
              </div>

              {/* Distance */}
              {popup.distance_km && (
                <p className="text-gray-500 text-xs pl-6">{popup.distance_km} km</p>
              )}

              {/* Camion */}
              <div className="flex items-center gap-2 text-gray-700">
                <Truck className="w-4 h-4 text-gray-400 flex-shrink-0" />
                <span>{popup.vehicule}</span>
              </div>

              {/* Chauffeur */}
              <div className="flex items-center gap-2 text-gray-700">
                <User className="w-4 h-4 text-gray-400 flex-shrink-0" />
                <span>{popup.chauffeur}</span>
              </div>
            </div>

            {/* Bouton voir la mission */}
            <button
              onClick={() => { setPopup(null); navigate('/missions'); }}
              className="mt-4 w-full text-center text-sm text-blue-600 hover:text-blue-700
                         font-medium border border-blue-200 hover:border-blue-300
                         rounded-lg py-2 transition-colors"
            >
              Voir toutes les missions
            </button>
          </div>
        </>
      )}
    </div>
  );
}
