import { useEffect, useRef, useState } from 'react';
import { Water } from 'three/examples/jsm/objects/Water.js';
import { Sky } from 'three/examples/jsm/objects/Sky.js';
import gsap from 'gsap';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import {
  BloomEffect,
  EffectComposer,
  EffectPass,
  RenderPass,
  OutlineEffect,
  BlendFunction,
  KernelSize,
} from 'postprocessing';
import * as THREE from 'three';
import { DeployCommandButton } from './commands/deploy-command.button';
import { MoveCommandButton } from './commands/move-command.button';
import { HealCommandButton } from './commands/heal-command.button';
import { CampCommandButton } from './commands/camp-command.button';
import { useGame } from '@/hooks/useGame';
import { UncampCommandButton } from './commands/uncamp-command.button';
import { DropButtonCommand } from './commands/drop-command.button';
import Image from 'next/image';
import useAPI from '@/hooks/useAPI';
import { useUser } from '@/hooks/useUser';
import { UndeployCommandButton } from './commands/undeploy-command.button';
import { CollectCommandButton } from './commands/collect.button';
import { prepareMove } from '@/features/commands/move.command';
import { useContractRead } from 'wagmi';
import config from '@/app/config';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { PointLight } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

const scene = new THREE.Scene();

const DateFormatter = new Intl.DateTimeFormat('en-US', {
  year: 'numeric',
  month: 'long',
  day: 'numeric',
});

export function LandCard() {
  const { game } = useGame();

  return (
    <div className="map-agent-in absolute bottom-0 flex w-full justify-center">
      <div className="mx-auto flex w-full max-w-screen-md items-center rounded-t-xl bg-neutral-950/50 px-6 py-6 backdrop-blur-2xl">
        <div className="flex w-max flex-col">
          <Image
            width={256}
            height={256}
            className="h-20 w-20 rounded-2xl"
            alt="test"
            src={'/art/' + game.samurai.Id + '.png'}
          />
          <div className="flex flex-col items-center">
            <div className="mt-1 w-full">
              <span className="mb-0.5 flex items-center text-yellow-500">
                <i className="ri-run-fill mr-1"></i>{' '}
                <span className="text-sm">
                  {game.samurai.CurrentAgility}/{game.samurai.MaxAgility}
                </span>
              </span>
            </div>
          </div>
        </div>
        <div className="ml-4 flex h-full flex-col">
          <h4 className="font-medium">SamuraiWarrior #{game.samurai.Id}</h4>
          <p
            className={
              'mt-1 text-sm ' +
              (game.samurai.IsInjured == true
                ? 'text-red-500'
                : 'text-green-500')
            }
          >
            <span>Health: </span>
            {game.samurai?.IsInjured ? 'Injured' : 'Healtly'}
          </p>
          <p className="mt-1 text-sm">
            <span>Status: </span>
            {game.samurai?.Status == 1
              ? 'In War'
              : game.samurai?.Status == 2
              ? 'Camp'
              : 'Available'}
          </p>
          {(game.samurai?.Status == 1 || game.samurai?.Status == 2) && (
            <p>
              {DateFormatter.format(
                new Date(
                  game.samurai.Status == 2
                    ? Number(game.samurai.CampTime)
                    : Number(game.samurai.DeploymentTime),
                ),
              )}
            </p>
          )}
        </div>
        <div className="ml-auto grid w-full max-w-sm grid-cols-2 gap-4">
          <div className="col-span-1">
            <span className="mb-1 flex items-center text-red-500">
              <i className="ri-sword-fill mr-1"></i>{' '}
              <span className="text-sm">{game.samurai.Attack}</span>
            </span>
            <div className="h-2 rounded-full bg-neutral-800">
              <div
                className="stats h-2 rounded-full bg-red-500"
                style={{ maxWidth: game.samurai.Attack * 5 + '%' }}
              ></div>
            </div>
          </div>
          <div className="col-span-1">
            <span className="mb-1 flex items-center text-blue-500">
              <i className="ri-shield-fill mr-1"></i>{' '}
              <span className="text-sm">{game.samurai.Defence}</span>
            </span>
            <div className="h-2 rounded-full bg-neutral-800">
              <div
                className="stats h-2 rounded-full bg-blue-500"
                style={{ maxWidth: game.samurai.Defence * 5 + '%' }}
              ></div>
            </div>
          </div>
          <div className="col-span-1">
            <span className="mb-1 flex items-center text-yellow-500">
              <i className="ri-sword-fill mr-1"></i>{' '}
              <span className="text-sm">{game.samurai.Chakra}</span>
            </span>
            <div className="h-2 rounded-full bg-neutral-800">
              <div
                className="stats h-2 rounded-full bg-yellow-500"
                style={{ maxWidth: game.samurai.Chakra * 5 + '%' }}
              ></div>
            </div>
          </div>
          <div className="col-span-1">
            <span className="mb-1 flex items-center text-green-500">
              <i className="ri-sword-fill mr-1"></i>{' '}
              <span className="text-sm">{game.samurai.CurrentAgility}</span>
            </span>
            <div className="h-2 rounded-full bg-neutral-800">
              <div
                className="stats h-2 rounded-full bg-green-500"
                style={{ maxWidth: game.samurai.CurrentAgility * 5 + '%' }}
              ></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function Map() {
  const user = useUser();
  const [area, setArea] = useState(null);

  const { game, setLand, setSamurai, setLands, setClans } = useGame();
  const { land: landAPI, user: userApi } = useAPI();
  const [locations, setLocations] = useState([]);
  const [deck, setDeck] = useState([]);

  const [selectedAgent, setSelectedAgent] = useState(-1);

  const [landModal, setLandModal] = useState(false);

  useContractRead({
    address: config.GAME_ADDRESS as any,
    abi: [
      {
        inputs: [
          {
            internalType: 'uint256',
            name: '_id',
            type: 'uint256',
          },
        ],
        name: 'viewSamurai',
        outputs: [
          {
            components: [
              {
                internalType: 'uint256',
                name: 'season',
                type: 'uint256',
              },
              {
                internalType: 'uint256',
                name: 'lightStones',
                type: 'uint256',
              },
              {
                internalType: 'uint256',
                name: 'campTime',
                type: 'uint256',
              },
              {
                internalType: 'uint256',
                name: 'deploymentTime',
                type: 'uint256',
              },
              {
                internalType: 'address',
                name: 'owner',
                type: 'address',
              },
              {
                internalType: 'uint8',
                name: 'location',
                type: 'uint8',
              },
              {
                internalType: 'uint8',
                name: 'attack',
                type: 'uint8',
              },
              {
                internalType: 'uint8',
                name: 'defence',
                type: 'uint8',
              },
              {
                internalType: 'uint8',
                name: 'chakra',
                type: 'uint8',
              },
              {
                internalType: 'uint8',
                name: 'maxAgility',
                type: 'uint8',
              },
              {
                internalType: 'uint8',
                name: 'currentAgility',
                type: 'uint8',
              },
              {
                internalType: 'bool',
                name: 'isInjured',
                type: 'bool',
              },
              {
                internalType: 'uint8',
                name: 'status',
                type: 'uint8',
              },
            ],
            internalType: 'struct Registration.Samurai',
            name: '',
            type: 'tuple',
          },
        ],
        stateMutability: 'view',
        type: 'function',
      },
    ],
    functionName: 'viewSamurai',
    args: [BigInt(Number(selectedAgent))],
    enabled: true,

    onSuccess: (data) => {
      const payload = {
        Season: Number(data.season),
        LightStones: Number(data.lightStones),
        Chakra: Number(data.chakra),
        Attack: Number(data.attack),
        Defence: Number(data.defence),
        MaxAgility: Number(data.maxAgility),
        CurrentAgility: Number(data.currentAgility),
        Location: Number(data.location),
        Status: Number(data.status),
        IsInjured: data.isInjured,
        CampTime: Number(data.campTime),
        DeploymentTime: Number(data.deploymentTime),
        Owner: data.owner,
        Id: selectedAgent,
        id: selectedAgent,
      };

      console.log(payload, data.status);

      setSamurai(payload);
    },
  });

  const onAgentSelect = async (data) => {
    setSelectedAgent(data);
  };

  const onAreaSelect = (name: string) => {
    const [_, id] = name.split('_');

    if (area == id) {
      return;
    }

    setArea(Number(id));
  };

  const coneGeometry = new THREE.ConeGeometry(10, 20, 32);
  const coneMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000 });
  useEffect(() => {
    onAreaChanged(area);
  }, [area]);

  const onAreaChanged = (id: number) => {
    if (id == null) {
      setLandModal(false);
      return;
    }

    const landData = game.lands.find((x) => x.id == id);

    if (!landModal) {
      setLandModal(true);
    }

    if (landData) {
      setLand(landData);

      // Işığı eklemek için gerekli işlemler
      const selectedHexagon = locations.find((hexagon) => hexagon.id === id);

      // Eğer seçili hexagon üzerinde bir ışık varsa, önce onu kaldıralım
      if (selectedHexagon) {
        const hexagonPosition = selectedHexagon.location;

        // Koni geometrisi ve malzemesi oluşturun
        const coneGeometry = new THREE.ConeGeometry(10, 20, 32);
        const coneMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000 });

        // Seçili alanın merkez noktasını hesaplayın
        const centerPoint = new THREE.Vector3();
        selectedHexagon.mesh.geometry.computeBoundingBox();
        selectedHexagon.mesh.geometry.boundingBox!.getCenter(centerPoint);

        // Koni nesnesini oluşturun
        const coneMesh = new THREE.Mesh(coneGeometry, coneMaterial);
        coneMesh.rotation.z = THREE.MathUtils.degToRad(90);
        coneMesh.rotation.x = THREE.MathUtils.degToRad(-90);

        // Koni nesnesinin pozisyonunu seçilen alanın merkezine ayarlayın
        coneMesh.position.copy(centerPoint);
        coneMesh.position.x += 10;
        selectedHexagon.mesh.add(coneMesh);
      }

      // Diğer alanlardaki konileri kaldırın
      locations.forEach((hexagon) => {
        if (hexagon.id !== id && hexagon.mesh.children.length > 0) {
          hexagon.mesh.remove(hexagon.mesh.children[0]);
        }
      });
    } else {
      setLand(null);
    }
  };

  // onAreaChanged fonksiyonunu çağıran useEffect ekleyin
  useEffect(() => {
    onAreaChanged(area);
  }, [area]);

  useEffect(() => {
    landAPI.getLands().then((data) => {
      setLands(data);
    });

    landAPI.getClans().then((data) => {
      setClans(data);
    });

    getDeck().then(async () => {
      await setup({
        locations: locations,
        setLocations: setLocations,
        onAreaSelect,
        deck,
      });
      setLocations([...locations]);
    });
  }, []);
  const [selectedHexagon, setSelectedHexagon] = useState(null);

  useEffect(() => {
    locations.forEach((location) => {
      const agentInLocation = deck.some((x) => x.Location == location.id);

      if (agentInLocation) {
        gsap.to(location.mesh.position, {
          x: location.mesh.position.x,
          y: location.mesh.position.y + 0.5,
          z: location.mesh.position.z,
          duration: 1,
          ease: 'power2.inOut',
        });
      }
    });
  }, [locations]);

  const getDeck = async () => {
    const _deck = await userApi.getOwnedNFTs(user.user.address);

    setDeck(_deck);
  };

  return (
    <div className="relative h-screen w-full overflow-hidden">
      <div className="h-full w-full" id="canvas"></div>
      <div className="absolute top-5 flex w-full justify-center gap-2">
        {deck.map((x, i) => (
          <button
            key={i}
            onClick={() => onAgentSelect(x)}
            className="rounded-full border-4 border-neutral-800 border-l-blue-500 border-r-red-500"
          >
            <Image
              height={56}
              width={56}
              className="h-14 w-14 rounded-full"
              alt="test"
              src={'/art/' + x + '.png'}
            />
          </button>
        ))}
      </div>

      {landModal && game.land && (
        <div className="map-land-in absolute right-0 top-0 z-50 flex h-full w-full max-w-md flex-col bg-neutral-950/50 px-8 py-4 backdrop-blur-2xl">
          <div className="flex items-center justify-between">
            <div className="flex flex-col">
              <h1 className="mb-2 text-2xl font-medium">{game.land.name}</h1>
              <p className="text-sm">{game.land.desc}</p>
            </div>
            <button onClick={() => setLandModal(false)}>
              <i className="ri-close-fill text-2xl"></i>
            </button>
          </div>
          <div className="mt-6 grid grid-cols-1 gap-4">
            <div className="col-span-1 flex flex-col rounded-xl bg-neutral-950/50 px-6 py-4">
              <div className="flex items-center justify-between">
                <h1 className="font-medium text-white/90">Land Details</h1>

                <div className="ml-auto">
                  <div
                    className={
                      'flex h-6 w-10 items-center justify-center rounded ' +
                      (game.land.clan == 1
                        ? 'bg-red-300'
                        : game.land.clan == 2
                        ? 'bg-green-300'
                        : game.land.clan == 3
                        ? 'bg-purple-300'
                        : game.land.clan == 4
                        ? 'bg-blue-300'
                        : 'bg-white')
                    }
                  >
                    <i className="ri-sword-fill text-lg text-black"></i>
                  </div>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-6">
                <div className="col-span-1">
                  <div className="flex items-end justify-between rounded-xl ">
                    <span className="text-sm text-white/80">Resource:</span>
                    <span className="text-base">{game.land.value}</span>
                  </div>
                </div>
                <div className="col-span-1">
                  <div className="flex items-end justify-between rounded-xl ">
                    <span className="text-sm text-white/80">Status:</span>
                    <span className="text-base">
                      {game.land.war_id == 0 ? 'Peace' : 'War'}
                    </span>
                  </div>
                </div>
                <div className="col-span-2">
                  <div className="flex items-center justify-center rounded-xl ">
                    <span className="mr-2 text-sm text-white/80">
                      Governance:
                    </span>
                    <span className="text-base">
                      {game.lands.find((x) => x.id == game.land.clan)?.name ||
                        'Neutral zone'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="mt-4 flex flex-col rounded-xl bg-neutral-950/50 px-6 py-4 backdrop-blur-2xl">
            <h1 className="font-medium text-white/90">Your NFTs is here</h1>

            <div className="mt-4">
              <div className="flex flex-col gap-4">
                <h2 className="text-sm text-white/50">Avaiable NFTs</h2>
                {deck
                  .filter((x) => x.Location == game.land.id && x.CampTime == 0)
                  .map((x, i) => (
                    <Image
                      key={i}
                      className="rounded-full"
                      src={'/art/' + x.Id + '.png'}
                      width={48}
                      height={48}
                      alt="no_camped"
                    />
                  ))}
              </div>
              <div className="mt-4 flex flex-col gap-4">
                <h2 className="text-sm text-white/50">Camped NFTs</h2>
                {deck
                  .filter((x) => x.Location == game.land.id && x.CampTime != 0)
                  .map((x, i) => (
                    <Image
                      key={i}
                      className="rounded-full"
                      src={'/art/' + x.Id + '.png'}
                      width={48}
                      height={48}
                      alt="no_camped"
                    />
                  ))}
              </div>
            </div>
          </div>
          {game.land.war_id != 0 && game.land.uri && (
            <div className="col-span-1 mt-6 h-32">
              <img
                className="h-full w-full rounded-xl"
                alt="asd"
                src={game.land.uri + '.ads.png'}
              />
            </div>
          )}

          {game.land.war_id == 0 && (
            <>
              <div className="mt-6">
                <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl bg-neutral-950/50 px-6 py-6">
                  <div className="flex flex-col items-center justify-center">
                    <div className="flex flex-col items-center">
                      <i className="ri-shield-fill mb-1 text-2xl"></i>
                      <span className="text-sm">
                        {game.lands.find((x) => x.id == game.land.clan)?.name ||
                          'Neutral zone'}
                      </span>
                    </div>
                    <div className="mt-8 w-full text-sm ">
                      <ul className="flex flex-col gap-1">
                        <li className="text-white/70">
                          Total Power: {game.land.defendersPower}
                        </li>
                      </ul>
                    </div>
                  </div>
                  <div>/</div>
                  <div className="flex flex-col items-center justify-center">
                    <div className="flex flex-col items-center">
                      <i className="ri-sword-fill mb-1 text-2xl"></i>
                      <span className="text-sm">
                        {' '}
                        {game.lands.find((x) => x.id == game.land.attackerClan)
                          ?.name || 'Neutral zone'}
                      </span>
                    </div>
                    <div className="mt-8 w-full text-sm">
                      <ul className="flex flex-col gap-1">
                        <li className="text-white/70">
                          Total Power: {game.land.attackersPower}
                        </li>
                      </ul>
                    </div>
                  </div>
                  <div className="mt-4 w-full">
                    <h2 className="text-sm text-white">Your NFTs</h2>
                    <div className="mt-4 flex flex-col">
                      <ul className="flex w-full flex-col">
                        {deck
                          .filter(
                            (x) =>
                              x.Location == game.land.id &&
                              x.DeploymentTime != 0,
                          )
                          .map((x, i) => (
                            <li key={i} className="flex items-center">
                              <span>{x.TokenName}</span>
                              <div className="ml-auto flex items-center gap-2 text-sm">
                                <span className="flex items-center">
                                  <i className="ri-sword-fill mr-1"></i>
                                  {x.Attack}
                                </span>
                                <span className="flex items-center">
                                  <i className="ri-shield-fill mr-1"></i>
                                  {x.Defence}
                                </span>
                              </div>
                            </li>
                          ))}
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
          <div className="mt-auto">
            <div className="mt-auto grid grid-cols-3 gap-3">
              {game.samurai &&
                game.land &&
                game.samurai?.Location == game.land.id &&
                game.land.id !=
                  game.clans.find((x) => x.ID == user.user.clan)
                    ?.baseLocation &&
                game.samurai.DeploymentTime == 0 && (
                  <DeployCommandButton></DeployCommandButton>
                )}
              {game.samurai &&
                game.land &&
                game.samurai?.Location == game.land.id &&
                game.samurai.DeploymentTime != 0 && (
                  <UndeployCommandButton></UndeployCommandButton>
                )}
              {game.samurai &&
                game.land &&
                game.samurai?.Location != game.land.id &&
                game.samurai.CampTime == 0 &&
                game.samurai.DeploymentTime == 0 &&
                prepareMove(
                  game.lands.find((x) => x.id == game.samurai?.Location),
                  game.land,
                ) &&
                (game.lands.find((x) => x.id == game.samurai.Location)?.id ==
                  game.clans.find((x) => x.ID == user.user.clan)
                    ?.baseLocation ||
                  game.land.id ==
                    game.clans.find((x) => x.ID == user.user.clan)
                      ?.baseLocation) && (
                  <MoveCommandButton></MoveCommandButton>
                )}
              {game.samurai &&
                game.land &&
                game.samurai.Location == game.land.id &&
                game.clans.find((x) => x.ID == user.user.clan)?.baseLocation ==
                  game.samurai?.Location && (
                  <HealCommandButton></HealCommandButton>
                )}
              {game.samurai &&
                game.land &&
                game.samurai.Location == game.land.id &&
                user.user.clan == game.land.clan && (
                  <CollectCommandButton></CollectCommandButton>
                )}
              {game.samurai &&
                game.land &&
                game.samurai.Location == game.land.id &&
                user.user.clan == game.land.clan && (
                  <DropButtonCommand></DropButtonCommand>
                )}
              {game.samurai &&
                game.land &&
                game.samurai.Location == game.land.id &&
                user.user.clan == game.land.clan &&
                game.samurai.CampTime == 0 && (
                  <CampCommandButton></CampCommandButton>
                )}
              {game.samurai &&
                game.land &&
                game.samurai.Location == game.land.id &&
                user.user.clan == game.land.clan &&
                game.samurai.CampTime != 0 && (
                  <UncampCommandButton></UncampCommandButton>
                )}
            </div>
          </div>
        </div>
      )}
      {game.samurai && <LandCard></LandCard>}
    </div>
  );
}

async function setup({ onAreaSelect, locations, setLocations, deck }) {
  let container;
  let camera, scene, renderer, composer;

  /*const textureLoader = new THREE.TextureLoader();
  const cloudTexture = textureLoader.load('/cloud.jpg', function (texture) {
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
  });

  const cloudPlaneMaterial = new THREE.MeshStandardMaterial({
    alphaMap: cloudTexture,
    color: 0xffffff,
    transparent: true,
  });

  cloudPlaneMaterial.alphaMap.repeat.set(10, 10);
  cloudPlaneMaterial.opacity = 0.3;
*/
  await init();
  animate();

  let mouse = new THREE.Vector2();
  let raycaster = new THREE.Raycaster();
  let activeSide;

  document.addEventListener('click', onMouseClick, false);

  function onMouseClick(event: MouseEvent) {
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);

    var intersects = raycaster
      .intersectObjects(scene.children, true)
      .filter((x) => x.object.name.includes('side'));
    if (intersects.length == 0) return;
    const point = intersects[0].point;

    const [area, setArea] = useState<number | null>(null); // Başlangıç değeri null olarak ayarlandı, tipi number veya null olabilir

    const onAreaSelect = (name: string) => {
      let selectedArea: number | null = null;

      switch (true) {
        case name.startsWith('side_'): {
          const id = name.substring(5);
          selectedArea = Number(id);
          break;
        }
        case name.startsWith('Circle'): {
          const parts = name.split('_');
          const id = parts[parts.length - 1];
          selectedArea = Number(id);
          break;
        }
        default:
          break;
      }

      if (selectedArea !== null && area !== selectedArea) {
        setArea(selectedArea);
      }
    };
  }

  async function init() {
    container = document.getElementById('canvas');

    //

    renderer = new THREE.WebGLRenderer({
      antialias: true, // Kenar yumuşatma etkisi aktif
      powerPreference: 'default', // Yüksek performans ayarı
      precision: 'highp', // Yüksek hassasiyet ayarı
    });

    renderer.outputEncoding = THREE.sRGBEncoding;

    renderer.setPixelRatio(window.devicePixelRatio * 0.9);
    renderer.setSize(container.clientWidth, container.clientHeight);

    container.appendChild(renderer.domElement);

    //

    scene = new THREE.Scene();

    camera = new THREE.PerspectiveCamera(
      45,
      container.clientWidth / container.clientHeight,
      1,
      10000,
    );
    camera.rotation.x = -Math.PI / 3;
    camera.position.set(0, 210, 150);

    //

    const controls = new OrbitControls(camera, renderer.domElement);
    //controls.enabled = false;
    //controls.enablePan = false;
    //controls.enableRotate = false;

    // Water

    // Skybox

    //

    window.addEventListener('resize', onWindowResize);

    /*const cloudPlaneGeometry = new THREE.PlaneGeometry(10000, 10000);

    const cloud = (cloudMesh = new THREE.Mesh(
      cloudPlaneGeometry,
      cloudPlaneMaterial,
    ));
    cloud.name = 'cloud';
    cloud.position.set(
      Math.random() * 800 - 400,
      1200, 
      Math.random() * 800 - 400,
    );
    cloud.rotation.x = -Math.PI / 2;
    scene.add(cloud);
*/
    const spotLight = new THREE.SpotLight(0xffffff, 0.6);
    spotLight.position.set(250, 250, 0);
    scene.add(spotLight);
    const spotLight1 = new THREE.SpotLight(0xffffff, 0.6);
    spotLight1.position.set(-250, 250, 0);
    scene.add(spotLight1);

    const spotLight3 = new THREE.SpotLight(0xffffff, 0.6);
    spotLight3.position.set(0, 250, 250);
    scene.add(spotLight3);

    const spotLight4 = new THREE.SpotLight(0xffffff, 0.6);
    spotLight4.position.set(0, 250, -250);
    scene.add(spotLight4);

    //const spotLightHelper = new THREE.SpotLightHelper(spotLight);
    // scene.add(spotLightHelper);

    let directionalLight = new THREE.SpotLight(0xffff00, 0);
    directionalLight.position.set(0, 1500, 500);
    directionalLight.lookAt(0, 0, 0);

    scene.add(directionalLight);

    const loader = new GLTFLoader();

    const group = await new Promise<THREE.Group>((resolve, reject) => {
      loader.load(
        '/map/ALTIGEN OYUN ADASIBOLMELI.gltf',
        (gltf) => {
          resolve(gltf.scene);
        },
        undefined,
        reject,
      );
    });

    // Mouse'un ekran koordinatlarını almak için kullanılacak değişkenler
    const mouse = new THREE.Vector2();
    const raycaster = new THREE.Raycaster();

    // Tıklama olayını dinlemek için event listener ekleyin
    window.addEventListener('click', onMapClick);

    function onMapClick(event) {
      // Fare koordinatlarını ekran boyutuna göre hesaplayın
      mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
      mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

      // Raycaster'ı tıklanan noktaya yönlendirin
      raycaster.setFromCamera(mouse, camera);

      // Raycaster ile tıklama noktasını hesaplayın
      const intersects = raycaster.intersectObjects(group.children, true);

      // Eğer tıklama noktası varsa
      if (intersects.length > 0) {
        const clickedObject = intersects[0].object;
        const parentObject = clickedObject.parent;
        // Tıklanan hexagonun ismini almak
        const groupName = clickedObject.parent.name;

        console.log('Tıklanan hexagonun grubu:', groupName);

        const position = parentObject.position; // Ana nesnenin konumu
        console.log('Tıklanan hexagonın konumu:', position);
        // Tıklanan nesnenin adını veya diğer özelliklerini kullanabilirsiniz
        getPayload(position, groupName);
        console.log(getPayload(position, groupName));
        locations.push(getPayload(position, groupName));
      }

      // ...
    }

    const getPayload = (position: any, groupName: string) => {
      let payloadObj: payload = {
        name: 'side_' + groupName,
        id: Number(groupName),
        location: position,
      };
      return payloadObj;
    };
    interface payload {
      name: string;
      location: number;
      id: number;
    }

    const formattedName = 'side_' + parent.name;
    parent.name = formattedName;

    group.scale.set(1.3, 1.3, 1.3);
    group.position.y = 50;
    group.position.z = 50;
    group.position.x = -110;
    scene.add(group);
  }

  function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;

    renderer.setSize(window.innerWidth, window.innerHeight);
  }

  function animate() {
    requestAnimationFrame(animate);

    //cloudPlaneMaterial.alphaMap.offset.y -= 0.00005;

    render();
  }

  function render() {
    renderer.render(scene, camera);
  }
}
