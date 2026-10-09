import { useState, useRef } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin    from '@fullcalendar/daygrid';
import timeGridPlugin   from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import { MapPin, Truck, User, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { ECRAN_ETROIT, useMediaQuery } from '../hooks/useMediaQuery';
import { usePlanning } from '../requetes';
import EnTetePage from '../components/ui/EnTetePage';
import Trajet from '../components/ui/Trajet';

const STATUT_CFG = {
  planifiee: { label: 'Planifiée',  cls: 'etat-neutre'  },
  en_cours:  { label: 'En cours',   cls: 'etat-actif'   },
  terminee:  { label: 'Terminée',   cls: 'bg-green-100  text-green-700'  },
  annulee:   { label: 'Annulée',    cls: 'bg-gray-100   text-gray-500'   }
};

const LEGENDE = [
  // Mêmes couleurs que les événements envoyés par l'API (COULEURS_PLANNING)
  { couleur: '#6c757d', label: 'Planifiée' },
  { couleur: '#212529', label: 'En cours'  },
  { couleur: '#198754', label: 'Terminée'  },
  { couleur: '#dee2e6', label: 'Annulée'   }
];

export default function Planning() {
  const navigate    = useNavigate();
  const calendarRef = useRef(null);
  // Sur téléphone : navigation en haut, choix de la vue en bas (la barre complète ne tient pas)
  const etroit = useMediaQuery(ECRAN_ETROIT);
  const [popup,    setPopup]    = useState(null);
  const [popupPos, setPopupPos] = useState({ x: 0, y: 0 });

  // Missions mises en cache : le calendrier se met à jour après une modification ou un
  // changement de statut reçu en temps réel
  const { data: evenements = [] } = usePlanning();

  const onEventClick = (info) => {
    // Sous l'événement, ou au-dessus s'il est en bas de l'écran ; toujours dans la fenêtre
    const rect = info.el.getBoundingClientRect();
    const LARGEUR = 320, HAUTEUR = 330, MARGE = 8;
    setPopupPos({
      x: Math.max(MARGE, Math.min(rect.left, window.innerWidth - LARGEUR - MARGE)),
      y: rect.bottom + MARGE + HAUTEUR <= window.innerHeight
        ? rect.bottom + MARGE
        : Math.max(MARGE, rect.top - HAUTEUR - MARGE),
    });
    setPopup({ id: info.event.id, titre: info.event.title, ...info.event.extendedProps });
  };

  return (
    <div className="d-flex flex-column gap-4">
      <EnTetePage
        titre="Planning"
        description="Missions dans le temps, par camion et par chauffeur"
        actions={(
          <ul className="legende list-unstyled mb-0" aria-label="Légende">
            {LEGENDE.map(({ couleur, label }) => (
              <li key={label}><span className="pastille-legende" style={{ background: couleur, boxShadow: 'inset 0 0 0 1px rgba(0,0,0,.08)' }} />{label}</li>
            ))}
          </ul>
        )}
      />

      {/* Calendrier */}
      <div className="card">
        <div className="card-body p-2 p-md-3">
          <FullCalendar
            ref={calendarRef}
            plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
            initialView="dayGridMonth"
            locale="fr"
            headerToolbar={etroit
              ? { left: 'prev,next', center: 'title', right: 'today' }
              : { left: 'prev,next today', center: 'title', right: 'dayGridMonth,timeGridWeek,timeGridDay' }}
            footerToolbar={etroit ? { center: 'dayGridMonth,timeGridWeek,timeGridDay' } : false}
            buttonText={{ today: "Aujourd'hui", month: 'Mois', week: 'Semaine', day: 'Jour' }}
            events={evenements}
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
          {/* Sur téléphone : panneau en bas de l'écran plutôt que bulle près de l'événement */}
          <div className="position-fixed bg-white rounded-4 shadow-lg border apparition" role="dialog" aria-label={popup.titre}
               style={etroit
                 ? { left: 8, right: 8, bottom: 8, zIndex: 1050, maxHeight: '70vh', overflowY: 'auto' }
                 : { left: popupPos.x, top: popupPos.y, zIndex: 1050, width: '320px' }}>
            <div className="p-3">
              <div className="d-flex align-items-start justify-content-between gap-2 mb-2">
                <div className="min-w-0">
                  <p className="fw-semibold mb-1">{popup.titre}</p>
                  <span className={`badge ${STATUT_CFG[popup.statut]?.cls || 'etat-neutre'}`}>{STATUT_CFG[popup.statut]?.label || popup.statut}</span>
                </div>
                <button onClick={() => setPopup(null)} className="btn btn-icone btn-icone-sm" aria-label="Fermer"><X size={14} /></button>
              </div>

              <div className="d-flex flex-column gap-2 small mt-3">
                <div className="d-flex align-items-center gap-2 text-gray-700">
                  <MapPin size={15} className="text-muted flex-shrink-0" />
                  <Trajet depart={popup.lieu_depart} destination={popup.lieu_destination} />
                  {popup.distance_km > 0 && <span className="text-muted">· {Math.round(popup.distance_km)} km</span>}
                </div>
                <div className="d-flex align-items-center gap-2 text-gray-700">
                  <Truck size={15} className="text-muted flex-shrink-0" />
                  <span>{popup.vehicule}</span>
                </div>
                <div className="d-flex align-items-center gap-2 text-gray-700">
                  <User size={15} className="text-muted flex-shrink-0" />
                  <span>{popup.chauffeur}</span>
                </div>
              </div>

              <button onClick={() => { setPopup(null); navigate('/missions'); }}
                      className="btn btn-outline-secondary btn-sm w-100 mt-3">
                Voir les missions
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
