# Lecture de scripts SQL (données de démonstration, tests)


def instructions_sql(texte: str):
    """
    Découpe un script SQL en instructions, comme le client mysql : gère la directive DELIMITER
    (procédures stockées), ignore les lignes de commentaire et les CREATE DATABASE / USE (le
    script s'exécute dans la base de la connexion).
    """
    delimiteur, courante = ";", []
    for ligne in texte.splitlines():
        brute = ligne.strip()
        # Lignes de commentaire ignorées partout : un "-- ...;" ne doit pas couper une instruction
        if brute.startswith("--") or (not courante and not brute):
            continue
        if brute.upper().startswith("DELIMITER "):
            delimiteur = brute.split()[1]
            continue
        courante.append(ligne)
        if brute.endswith(delimiteur):
            instruction = "\n".join(courante).rstrip()[: -len(delimiteur)].strip()
            courante = []
            if instruction.upper().lstrip().startswith(("CREATE DATABASE", "USE ")):
                continue
            yield instruction
    reste = "\n".join(courante).strip()
    if reste:
        yield reste
