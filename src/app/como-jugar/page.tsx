import Link from 'next/link';
import type { Metadata } from 'next';
import { Carta } from '@/components/Carta';
import { SENAS } from '@/lib/social';

export const metadata: Metadata = {
  title: 'Cómo se juega · Truco',
  description: 'Reglas del truco argentino explicadas para quien nunca jugó: cartas, bazas, truco, envido, flor y puntos.',
};

const JERARQUIA: { cartas: string[]; nombre: string }[] = [
  { cartas: ['1e'], nombre: 'Ancho de espada' },
  { cartas: ['1b'], nombre: 'Ancho de basto' },
  { cartas: ['7e'], nombre: 'Siete de espada' },
  { cartas: ['7o'], nombre: 'Siete de oro' },
  { cartas: ['3e', '3b', '3o', '3c'], nombre: 'Los tres' },
  { cartas: ['2e', '2b', '2o', '2c'], nombre: 'Los dos' },
  { cartas: ['1o', '1c'], nombre: 'Anchos falsos' },
  { cartas: ['12e', '12b', '12o', '12c'], nombre: 'Reyes (12)' },
  { cartas: ['11e', '11b', '11o', '11c'], nombre: 'Caballos (11)' },
  { cartas: ['10e', '10b', '10o', '10c'], nombre: 'Sotas (10)' },
  { cartas: ['7b', '7c'], nombre: 'Sietes falsos' },
  { cartas: ['6e', '6b', '6o', '6c'], nombre: 'Seis' },
  { cartas: ['5e', '5b', '5o', '5c'], nombre: 'Cinco' },
  { cartas: ['4e', '4b', '4o', '4c'], nombre: 'Cuatro' },
];

const SECCIONES = [
  ['objetivo', 'De qué se trata'],
  ['cartas', 'Las cartas'],
  ['bazas', 'Las bazas'],
  ['truco', 'El truco'],
  ['envido', 'El envido'],
  ['flor', 'La flor'],
  ['mazo', 'Irse al mazo'],
  ['puntos', 'Cómo se anota'],
  ['equipos', 'De a cuatro y de a seis'],
  ['senas', 'Las señas'],
  ['consejos', 'Consejos para arrancar'],
] as const;

function Seccion({ id, titulo, children }: { id: string; titulo: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-6 rounded-3xl bg-pano-osc/55 p-6 sm:p-8">
      <h2 className="mb-3 font-mano text-3xl font-bold">{titulo}</h2>
      <div className="flex flex-col gap-3 text-lg leading-relaxed text-claro/90">{children}</div>
    </section>
  );
}

function Tabla({ filas, cabecera }: { filas: (string | number)[][]; cabecera: string[] }) {
  return (
    <div className="overflow-x-auto rounded-2xl bg-papel p-3 text-tinta">
      <table className="w-full font-mano text-lg">
        <thead>
          <tr className="border-b-2 border-tinta/60">
            {cabecera.map((c) => (
              <th key={c} className="px-2 py-1 text-left font-bold">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {filas.map((f, i) => (
            <tr key={i} className="border-b border-tinta/15">
              {f.map((c, j) => (
                <td key={j} className="px-2 py-1">
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function ComoJugar() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-8">
      <header className="flex items-center justify-between">
        <Link href="/" className="font-mano text-3xl font-bold">Truco</Link>
        <Link href="/maquina" className="rounded-xl bg-oro px-4 py-2 font-bold text-tinta">Practicar</Link>
      </header>

      <div>
        <h1 className="font-mano text-6xl font-bold leading-none">Cómo se juega</h1>
        <p className="mt-3 max-w-xl text-lg text-claro/85">
          El truco se aprende jugando. Leé esto una vez, armá una partida contra la máquina y volvé cuando te quede una duda.
        </p>
      </div>

      <nav aria-label="Temas" className="flex flex-wrap gap-2">
        {SECCIONES.map(([id, t]) => (
          <a key={id} href={`#${id}`} className="rounded-full bg-pano-osc/60 px-3 py-1 text-sm hover:bg-pano-osc">
            {t}
          </a>
        ))}
      </nav>

      <Seccion id="objetivo" titulo="De qué se trata">
        <p>
          Se juega con la baraja española de 40 cartas (sin 8 ni 9). A cada jugador le tocan <strong>3 cartas</strong> por mano. Gana el primero
          que llega a <strong>15 o 30 puntos</strong>, según cómo se arme la mesa.
        </p>
        <p>
          Los puntos salen de dos peleas distintas dentro de cada mano: <strong>el truco</strong> (quién gana las cartas) y{' '}
          <strong>el envido</strong> (quién tiene mejores puntos de palo). Y lo más lindo: se puede mentir.
        </p>
      </Seccion>

      <Seccion id="cartas" titulo="Las cartas">
        <p>Para ganar las bazas, las cartas no valen por su número sino por este orden. De la más fuerte a la más débil:</p>
        <ol className="flex flex-col gap-2">
          {JERARQUIA.map((j, i) => (
            <li key={j.nombre} className="flex items-center gap-3">
              <span className="w-6 text-right font-mano text-xl font-bold text-oro">{i + 1}</span>
              <span className="flex gap-1">
                {j.cartas.map((c) => (
                  <Carta key={c} id={c} size="sm" />
                ))}
              </span>
              <span className="font-semibold">{j.nombre}</span>
            </li>
          ))}
        </ol>
        <p className="text-base text-claro/75">
          Las cartas que están en el mismo renglón empatan entre sí. Por ejemplo, un tres de oro contra un tres de copa es parda.
        </p>
      </Seccion>

      <Seccion id="bazas" titulo="Las bazas">
        <p>
          Cada mano se juega a <strong>tres bazas</strong>. En cada una, cada jugador tira una carta y gana la más alta. El que gana{' '}
          <strong>dos bazas</strong> se lleva la mano.
        </p>
        <p>
          Empieza el que <strong>es mano</strong> (el de la derecha del que reparte; acá la mano va rotando sola). Después de cada baza, sale primero
          el que la ganó.
        </p>
        <p>
          <strong>Parda</strong> es cuando empatan. Si se empata la primera, gana la mano quien gane la segunda. Si se gana la primera y se empata
          la segunda o la tercera, gana el de la primera. Si se empatan todas, gana el que es mano.
        </p>
        <p>
          En la mesa vas a ver las cartas que tiró cada uno delante suyo, y la que ganó cada baza marcada en dorado.
        </p>
      </Seccion>

      <Seccion id="truco" titulo="El truco">
        <p>
          Sin cantar nada, ganar la mano vale <strong>1 punto</strong>. En cualquier momento de tu turno podés cantar <strong>¡Truco!</strong> para
          que valga más. El rival tiene que contestar:
        </p>
        <ul className="ml-5 list-disc">
          <li><strong>Quiero:</strong> se sigue jugando y la mano vale lo cantado.</li>
          <li><strong>No quiero:</strong> la mano termina y el que cantó se lleva lo que valía antes.</li>
          <li><strong>Subir:</strong> en vez de contestar, cantar el siguiente nivel.</li>
        </ul>
        <Tabla
          cabecera={['Canto', 'Si quieren', 'Si no quieren']}
          filas={[
            ['Truco', '2 puntos', '1 punto'],
            ['Quiero retruco', '3 puntos', '2 puntos'],
            ['Quiero vale cuatro', '4 puntos', '3 puntos'],
          ]}
        />
        <p>
          Después de un <em>quiero</em>, sólo puede subir el que aceptó. Ahí está la gracia: podés cantar truco con malas cartas para que el otro se
          asuste y no quiera.
        </p>
      </Seccion>

      <Seccion id="envido" titulo="El envido">
        <p>
          Es una apuesta aparte sobre los puntos de tus cartas. Se canta <strong>sólo en la primera baza</strong>, antes de que se cante el truco o
          como respuesta a un truco (<em>el envido está primero</em>).
        </p>
        <p>Cómo contar tus puntos:</p>
        <ul className="ml-5 list-disc">
          <li>Si tenés <strong>dos cartas del mismo palo</strong>: 20 + el valor de las dos.</li>
          <li>Si no: vale tu carta más alta, sola.</li>
          <li>Las figuras (10, 11 y 12) valen 0. El resto vale su número.</li>
        </ul>
        <div className="flex flex-col gap-3 rounded-2xl bg-pano-osc/60 p-4">
          {[
            [['7o', '6o', '1e'], '7 + 6 de oro, más 20: tenés 33, lo máximo.'],
            [['12e', '5e', '3c'], 'Rey (0) + 5 de espada, más 20: tenés 25.'],
            [['4b', '6c', '11o'], 'Ningún palo repetido: vale la más alta, 6.'],
          ].map(([cartas, texto]) => (
            <div key={texto as string} className="flex flex-wrap items-center gap-3">
              <span className="flex gap-1">
                {(cartas as string[]).map((c) => (
                  <Carta key={c} id={c} size="sm" />
                ))}
              </span>
              <span>{texto}</span>
            </div>
          ))}
        </div>
        <p className="text-base text-claro/80">Tranqui: durante la primera baza, la mesa te muestra cuánto tenés.</p>
        <Tabla
          cabecera={['Canto', 'Si quieren (gana el mejor)', 'Si no quieren']}
          filas={[
            ['Envido', '2', '1'],
            ['Real envido', '3', '1'],
            ['Envido + envido', '4', '2'],
            ['Envido + real envido', '5', '2'],
            ['Falta envido', 'lo que le falta al que va ganando', 'lo cantado antes, o 1'],
          ]}
        />
        <p>
          Si empatan en puntos, gana el que es mano (o el más cercano a la mano). Cuando se quiere, la mesa muestra quién ganó y con cuántos.
        </p>
      </Seccion>

      <Seccion id="flor" titulo="La flor">
        <p>
          Sólo si la mesa se armó <strong>con flor</strong>. Tener flor es tener <strong>las tres cartas del mismo palo</strong>. Si la tenés, la
          cantás y sumás <strong>3 puntos</strong>; además, anula el envido.
        </p>
        <p>
          Si el rival también tiene flor, puede achicarse (le das 4 puntos al que cantó), cantar <strong>contraflor</strong> (6 puntos para la mejor
          flor) o <strong>contraflor al resto</strong> (se juega la falta).
        </p>
      </Seccion>

      <Seccion id="mazo" titulo="Irse al mazo">
        <p>
          Si ves que la mano está perdida, podés <strong>irte al mazo</strong>: abandonás la mano y el rival se lleva lo que valía. Si te vas en la
          primera baza sin que se haya cantado envido, el rival suma un punto más. A veces conviene perder poco antes que mucho.
        </p>
      </Seccion>

      <Seccion id="puntos" titulo="Cómo se anota">
        <p>
          Los puntos se anotan con <strong>palitos de a cinco</strong>: cuatro lados de un cuadrado y la diagonal. Lo vas a ver en el anotador de
          papel al costado de la mesa.
        </p>
        <p>
          A 30 se juega en dos mitades: los primeros 15 son <strong>las malas</strong> y los otros 15, <strong>las buenas</strong>. Importa para la
          falta envido: si el que va ganando todavía está en las malas, la falta envido gana el partido entero.
        </p>
      </Seccion>

      <Seccion id="equipos" titulo="De a cuatro y de a seis">
        <p>
          En <strong>2 contra 2</strong> y <strong>3 contra 3</strong> los compañeros se sientan alternados. Juegan por equipo: si tu compañero gana la
          baza, la gana tu equipo. Cualquiera del equipo puede contestar un canto, y el envido se compara entre todos (gana el mejor de la mesa).
        </p>
        <p>Tenés un chat de equipo que los rivales no ven, y las señas.</p>
      </Seccion>

      <Seccion id="senas" titulo="Las señas">
        <p>
          En la mesa de verdad, los compañeros se avisan qué cartas tienen con gestos, sin que los vea el rival. Acá tu personaje hace el gesto y
          sólo lo ve tu compañero. Las más usadas:
        </p>
        <Tabla cabecera={['Gesto', 'Significa']} filas={SENAS.map((s) => [s.gesto, s.significa])} />
        <p className="text-base text-claro/75">Cada mesa tiene sus variantes; éstas son las más difundidas.</p>
      </Seccion>

      <Seccion id="consejos" titulo="Consejos para arrancar">
        <ul className="ml-5 list-disc">
          <li>Con un ancho de espada o de basto, el truco está de tu lado: cantalo.</li>
          <li>Con 27 o más de envido, cantá envido. Con 30 o más, animate al real envido.</li>
          <li>En primera, si sos mano, no tires tu mejor carta de entrada.</li>
          <li>Si el rival canta truco y tus cartas son flojas, &quot;no quiero&quot; cuesta un solo punto.</li>
          <li>Y de vez en cuando, mentí. Es truco.</li>
        </ul>
        <div className="mt-2 flex flex-wrap gap-3">
          <Link href="/maquina" className="rounded-2xl bg-rojo px-6 py-3 text-xl font-bold shadow-[0_4px_0_rgba(0,0,0,.4)]">
            Practicar contra la máquina
          </Link>
          <Link href="/" className="rounded-2xl px-6 py-3 text-lg underline">
            Volver al inicio
          </Link>
        </div>
      </Seccion>
    </main>
  );
}
