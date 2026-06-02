import React, { useState, useRef } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin    from '@fullcalendar/daygrid';
import timeGridPlugin   from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import { Calendar, X, MapPin, Truck, User, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';

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
  const navigate    = useNavigate();
  const calendarRef = useRef(null);
  const [popup,    setPopup]    = useState(null);
  const [popupPos, setPopupPos] = useState({ x: 0, y: 0 });

  const chargerEvenements = async () => {
    const { data } = await api.get('/missions/planning');
    return data;
  };

  const onEventClick = (info) => {
    const rect = info.el.getBoundingClientRect();
    setPopupPos({
      x: Math.min(rect.left, window.innerWidth - 320),
      y: rect.bottom + window.scrollY + 8
    });
    setPopup({ id: info.event.id, titre: info.event.title, ...info.event.extendedProps });
  };

  return (
    <div className="d-flex flex-column gap-3">

      {/* En-tête */}
      <div className="d-flex align-items-center justify-content-between flex-wrap gap-3">
        <div className="d-flex align-items-center gap-3">
          <div className="bg-blue-100 rounded-3 p-2">
            <Calendar size={24} className="text-blue-600" />
          </div>
          <div>
            <h1 className="fs-4 fw-bold text-dark mb-0">Planning des missions</h1>
            <p className="text-muted small mb-0">Vue calendrier de toutes les missions</p>
          </div>
        </div>
        <div className="d-flex align-items-center gap-3">
          {LEGENDE.map(({ couleur, label }) => (
            <div key={label} className="d-flex align-items-center gap-2 small text-gray-600">
              <span className="rounded-circle flex-shrink-0" style={{ width: '12px', height: '12px', backgroundColor: couleur }} />
              {label}
            </div>
          ))}
        </div>
      </div>

      {/* Calendrier */}
      <div className="card border rounded-3">
        <div className="card-body p-3">
          <FullCalendar
            ref={calendarRef}
            plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
            initialView="dayGridMonth"
            locale="fr"
            headerToolbar={{ left: 'prev,next today', center: 'title', right: 'dayGridMonth,timeGridWeek,timeGridDay' }}
            buttonText={{ today: "Aujourd'hui", month: 'Mois', week: 'Semaine', day: 'Jour' }}
            events={chargerEvenements}
            eventClick={onEventClick}
            dateClick={() => navigate('/missions')}
            eventDisplay="block"
            dayMaxEvents={3}
            height="auto"
            eventClassNames="cursor-pointer"
          />
        </div>
      </div>

      {/* Popup détail */}
      {popup && (
        <>
          <div className="position-fixed top-0 start-0 w-100 h-100" style={{ zIndex: 1040 }}
               onClick={() => setPopup(null)} />
          <div className="position-fixed bg-white rounded-3 shadow-lg border"
               style={{ left: popupPos.x, top: popupPos.y, zIndex: 1050, width: '320px' }}>
            <div className="p-4">
              <div className="d-flex align-items-start justify-content-between mb-3">
                <h3 className="fw-bold text-dark small mb-0 pe-2">{popup.titre}</h3>
                <button onClick={() => setPopup(null)} className="btn-close" />
              </div>

              <div className="d-flex flex-column gap-2 small">
                <div>
                  <span className={`badge rounded-pill fw-medium ${STATUT_CFG[popup.statut]?.cls || 'bg-gray-100 text-gray-600'}`}>
                    {STATUT_CFG[popup.statut]?.label || popup.statut}
                  </span>
                </div>
                <div className="d-flex align-items-center gap-2 text-gray-700">
                  <MapPin size={16} className="text-muted flex-shrink-0" />
                  <span>{popup.lieu_depart}</span>
                  <ArrowRight size={12} className="text-muted" />
                  <span>{popup.lieu_destination}</span>
                </div>
                {popup.distance_km && (
                  <p className="text-muted mb-0 ps-4">{popup.distance_km} km</p>
                )}
                <div className="d-flex align-items-center gap-2 text-gray-700">
                  <Truck size={16} className="text-muted flex-shrink-0" />
                  <span>{popup.vehicule}</span>
                </div>
                <div className="d-flex align-items-center gap-2 text-gray-700">
                  <User size={16} className="text-muted flex-shrink-0" />
                  <span>{popup.chauffeur}</span>
                </div>
              </div>

              <button onClick={() => { setPopup(null); navigate('/missions'); }}
                      className="btn btn-outline-primary btn-sm w-100 mt-3">
                Voir toutes les missions
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
