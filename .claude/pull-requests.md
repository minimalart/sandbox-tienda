# Cómo hacer Pull Requests en Minimalart

Esta guía define un único criterio para abrir, revisar y mergear Pull Requests. El objetivo no es burocratizar: es que cualquier persona del equipo pueda abrir una rama, leer un PR ajeno o retomar un trabajo de hace tres semanas sin tener que adivinar las convenciones de quien lo escribió. Si todos partimos del mismo formato, la revisión deja de discutir forma y se concentra en lo que importa: el código.

Aplica a todos los repositorios de Minimalart en GitHub. Los tickets viven en Plane; los PRs, en GitHub. El nexo entre los dos es el identificador del ticket, y por eso es la pieza que ordena todo lo demás.

## Antes de empezar

Todo trabajo arranca en un ticket de Plane. Si vas a tocar código y no hay ticket, primero creá el ticket: es lo que después da nombre a la rama, contexto al PR y trazabilidad a la revisión. Cada ticket de Plane tiene un identificador con la forma `IDENTIFICADOR-NÚMERO` —por ejemplo `MINIM-142` (proyecto minimalart), `SELEC-87` (Selectio) o `AEC-210` (aec_arg)—. Ese identificador es el hilo que vas a repetir en la rama, en los commits y en el PR.

Antes de crear la rama:

- Confirmá que el ticket existe en Plane y que está asignado a vos.
- Actualizá tu rama base local (`git checkout main && git pull`).
- Verificá desde qué rama tenés que partir. Por defecto es `main`; si el repo trabaja con `develop` o con una rama de release, partí de esa.

## 1. Nombrar la feature branch desde el ticket

El nombre de la rama se construye a partir del ticket. La convención es:

```
tipo/IDENTIFICADOR-DESCRIPCIÓN-CORTA
```

- **tipo** — qué clase de trabajo es: `feat` (funcionalidad), `fix` (corrección), `refactor`, `chore` (config/dependencias), `docs` o `test`.
- **IDENTIFICADOR** — el identificador del ticket de Plane, tal cual, en mayúsculas (`MINIM-142`).
- **DESCRIPCIÓN-CORTA** — dos a cuatro palabras en minúscula y separadas por guiones, que digan de qué se trata. No es el título completo del ticket, es un resumen para reconocer la rama de un vistazo.

Ejemplos reales según el proyecto:

```
feat/MINIM-142-hero-landing
fix/SELEC-87-validacion-checkout
chore/AEC-210-bump-dependencias
refactor/SAPHI-58-servicio-pagos
docs/INFRA-12-readme-deploy
```

Reglas que aplican siempre:

- Una rama, un ticket. Si el trabajo abarca más de un ticket, casi siempre conviene partirlo en ramas y PRs separados.
- Todo en minúscula salvo el identificador del ticket, que va como lo muestra Plane.
- Sin espacios, tildes ni caracteres especiales: solo letras, números y guiones.
- Mantené la descripción corta. La rama no necesita contar toda la historia; para eso está el ticket.

## 2. Trabajar y commitear con la skill `git-commit`

Una rama bien nombrada se arruina si adentro tiene quince commits que dicen "cambios", "fix", "ahora sí". El historial de commits es documentación: explica por qué el código llegó a donde está. Para que ese historial sea legible y uniforme entre todos, **no escribimos los mensajes de commit a mano: usamos la skill `git-commit`.**

### El flujo

1. Hacé tus cambios y revisá qué vas a incluir (`git add` de lo que corresponda; commits chicos y enfocados son mejores que un commit gigante con todo junto).
2. Con los cambios en *staging*, pedile a Claude Code que cree el commit usando la skill `git-commit`.
3. La skill lee el *diff* en *staging*, redacta el mensaje con el formato estándar del equipo y lo deja referenciado al ticket. Vos revisás que describa de verdad el cambio y confirmás.

El valor de hacerlo así es justamente que todos terminamos con el mismo criterio sin tener que recordarlo de memoria. No hace falta aprender ni aplicar el formato a mano: la skill se encarga del mensaje completo; nosotros solo aportamos el contexto y confirmamos.

## 3. Abrir el Pull Request

Con la rama pusheada, abrí el PR en GitHub contra la rama base correspondiente.

**Título del PR.** Mismo criterio que el commit, empezando por el identificador del ticket:

```
MINIM-142 — feat: hero de la nueva landing
```

**Descripción.** No la escribimos a mano: GitHub la prerellena a partir de los commits, y como salen prolijos de `git-commit`, queda legible sola. Basta con revisarla. Para que el ticket de Plane se cierre al mergear, dejá que el identificador quede en el PR (por ejemplo, una línea `Closes MINIM-142`).

**Tamaño.** Un PR chico se revisa bien; uno de dos mil líneas se aprueba sin mirar. Si el cambio creció mucho, es señal de que el ticket era demasiado grande. Buscá que cada PR sea revisable en una sentada.

**Draft.** Si querés feedback temprano o el trabajo no está terminado, abrilo como *draft*. Pasalo a *ready for review* recién cuando esté listo para mergear.

**Revisión automática.** Al abrir el PR, la revisión corre sola: una herramienta de IA (CodeRabbit / Claude review) analiza el código y deja sus comentarios. Atendelos —resolviéndolos o explicando por qué no— antes de mergear.

## 4. Merge y cierre

- Esperá a que pasen los checks automáticos (CI, linter, tests) y a haber atendido los comentarios de la revisión automática.
- Mergeá con **squash** salvo que el repo indique lo contrario: el historial de `main` queda limpio, con un commit por PR.
- Confirmá que el ticket de Plane quedó cerrado (automático si usaste `Closes`, manual si no).
- Borrá la rama una vez mergeada. GitHub ofrece hacerlo en el mismo botón.

## Checklist antes de abrir el PR

- [ ] Existe el ticket en Plane y estoy asignado.
- [ ] La rama sigue `tipo/IDENTIFICADOR-descripción`.
- [ ] Los commits se crearon con la skill `git-commit` y referencian el ticket.
- [ ] El PR tiene título con el identificador y el ticket queda vinculado para cerrarse al mergear.
- [ ] El cambio es lo bastante chico como para revisarse de una.
- [ ] Pasan los checks automáticos.

---

### Referencia rápida

| Etapa   | Formato                              | Ejemplo                                  |
| ------- | ------------------------------------ | ---------------------------------------- |
| Rama    | `tipo/IDENTIFICADOR-descripción`     | `feat/MINIM-142-hero-landing`            |
| Commit  | Lo genera la skill `git-commit`      | `pedí a Claude Code que commitee con git-commit` |
| PR      | `IDENTIFICADOR — tipo: resumen`      | `MINIM-142 — feat: hero de la landing`   |
