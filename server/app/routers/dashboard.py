# Route du tableau de bord
from ..auth import Connecte
from ..schemas.pilotage import StatistiquesTableauDeBord
from ..services import tableau_de_bord as service
from ..utils import Routeur

router = Routeur()


@router.get("/stats", dependencies=[Connecte], response_model=StatistiquesTableauDeBord,
            summary="Indicateurs du tableau de bord")
async def indicateurs():
    return await service.indicateurs()
