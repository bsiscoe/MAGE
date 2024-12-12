// import { 

// } from '';


export function generateshaderparkcode(shader)  {
    // Put your Shader Park Code here
    if (shader == 'default') 
    {
      return `
      let size = input()
      let pointerDown = input()
      time = .3*time
	  size *= 1.3
      rotateY(mouse.x * -5 * PI / 2 * sin(time) -(pointerDown+0.1))
      rotateX(mouse.y * 5 * PI / 2 * sin(time))
      metal(.5*size)
      color(normalize(getRayDirection())+.2)
      rotateY(sin(getRayDirection().y*8*(ncos(sin(time)))+size))
	  rotateX(cos((getRayDirection().x*16*nsin(time)+size)))
	  rotateZ(ncos((getRayDirection().z*4*cos(time)+size)))
      boxFrame(vec3(size), size*.1)
      shine(0.8*size)
      blend(nsin(time*(size))*0.1+0.1)
      sphere(size/2-pointerDown*.3)
      blend(ncos((time*(size)))*0.1+0.1)
      boxFrame(vec3(size-.1*pointerDown), size)
      `
    } else if (shader == 'og')
      {
      return `
      let size = input()
      let pointerDown = input()
      
      rotateY(mouse.x * -4 * PI / 2 + time + size * .10 -(pointerDown+0.1))
      rotateX(mouse.y * 4 * PI / 2 + time + size * .10 )
      metal(.5)
      color(normalize(getRayDirection())+.2)
      rotateY(getRayDirection().y*6+size)
      boxFrame(vec3(size), size)
      shine(.4)
      expand(-.02*size+.02)
      blend(nsin((time*(size+1)))*0.1+0.1)
      sphere(size/2-pointerDown*.3)
      blend(ncos((time*(size+1)))*0.1+0.1)
      boxFrame(vec3(size-pointerDown), size-pointerDown)
      `;
    } else if (shader == 'test') { 
      return `
        let size = input()
      let pointerDown = input()
        let march = glslFunc(\`
          struct Ray {
          vec3 origin;
          vec3 direction;
        };
            
        struct Sphere {
            vec3 position;
            float radius;
        };

        struct Plane {
          vec3 normal;
            float offset;
        };
            
        struct FarLight {
          vec3 direction;
            vec4 color;
        };        

        struct PointLight {
          vec3 position;
            vec4 color;
        };

        const vec4 ambient = vec4(0.1,0.05,0.07,1.0);
        const vec4 planeColor = vec4( 0.64, 0.68, 0.55, 1.0);
        const vec4 sphereColor = vec4( 0.84, 0.93, 0.07, 1.0);
            
        Plane p1 = Plane(vec3(0.0,1.0,0.0), 1.5);

        vec3 repeat( vec3 v ) {
            return vec3(mod(v.x,4.0)-2.0, v.y, mod(v.z,10.0));   
        }
            
        float distFromSphere(Sphere s, vec3 p) {
          return distance(repeat(p),s.position)-s.radius;  
        }

        float distFromPlane(Plane plane, vec3 p) {
          return dot(plane.normal, p) + plane.offset;
        }

        vec3 mainImage(vec3 rayDir, float iTime) {
            
            FarLight sun = FarLight(normalize(vec3(sin(iTime),0.4,cos(0.43*iTime))), vec4(1.0,0.8,0.75,1.0));

            Sphere sphere1 = Sphere(vec3(0.0,cos(iTime),8.0+0.5*sin(iTime)),1.5);
            
            vec3 mass = vec3(5.0*sin(0.6*iTime), 2.5, 15.0+5.5*iTime+4.0*cos(0.2*iTime));


            //vec2 uv = fragCoord.xy / iResolution.xy - vec2(0.5);
            //uv.x *= iResolution.x / iResolution.y;
            
            int pHits = 0;
            int sHits = 0;
            vec4 color =  vec4(0.0,0.0,0.0,1.0);
            vec3 reflectDirection;
            
            Ray ray = Ray(vec3(0.0,3.0,999.0)-6.0*rayDir, -rayDir);
            
            for (int bounce = 0; bounce<5; ++bounce) {

                for (int i=0; i<40; ++i) {
                    float distS = distFromSphere(sphere1, ray.origin);
                    float distP = distFromPlane(p1, ray.origin);
                    
                    if (distS < 0.005) {
                        sHits++;
                vec3 norm = normalize(sphere1.position - repeat(ray.origin));
                        ray.direction = reflect(ray.direction, norm);
                        ray.origin += ray.direction * 0.08;
                        break;
                    }
                    
                    if (distP < 0.005) {
                pHits++;
                        ray.direction = reflect(ray.direction, p1.normal);
                        ray.origin += ray.direction * 0.08;
                        break;	
                    }
                    

                    vec3 difference = ray.origin - mass;
              float mDist = length(difference);
                    float minDist =  min(min(distS, distP),mDist);
                    if (mDist > 600.0) break;
                    //float force = 0.02*((sin(0.23*iTime)+1.0)) / (mDist*mDist);
                    //ray.direction = normalize(ray.direction - minDist * force * difference);
                    ray.origin += ray.direction * minDist * 0.9;

                }
            } 
            
            if (pHits + sHits > 0) {
                float ph = float(pHits); 
                float sh = float(sHits);
              float angle = dot(sun.direction, ray.direction);
              //specular
              color += pow(max(angle, 0.0), 180.0) * vec4(0.8);
              color += (max(angle, 0.0) * sun.color * pow(planeColor, vec4(ph)) * pow(sphereColor, vec4(sh))) / pow(ph+sh,1.0);
              color += ambient;
            }
            
            return color.xyz;
            }\`)

            let r = getRayDirection()
            let col = march(r, 100.0+2.0*sin(0.5*time))
            noLighting()
            setMaxIterations(0)
            color(col)
            sphere(2);

      `
  } else if (shader == 'test2') { 
    return `
      let size = input()
      let pointerDown = input()
      let koch = glslFunc(\`
      //https://www.shadertoy.com/view/Mlf3RX
      float koch(vec2 p)
      {
          float ft = mod(floor(time),6.)+1.;
          p = abs(fract(p)-0.5);
          for(int i=0;i<12;++i)
          {
              if (floor(float(i)*.5) > ft)break; //"animation"
          if(time == 0.0) {
              p += vec2(p.y*1.735, -p.x*1.735);
              p.x = abs(p.x)-0.58;
              p = -vec2(-p.y, p.x)*.865;
              } else {
                p = -vec2(-p.y + p.x*1.735, abs(p.x + p.y*1.735) - 0.58)*.865; //One loc version
              }
          }
          return mod(floor(time*2.),2.)>0. ? abs(p.x)/(ft*ft)*14. : p.x/(ft*ft)*16.;
          //return p.x;
      }
      \`);
      rotateX(PI/2);
      let s= getSpace();
      let col = koch(vec2(s.x, s.z));
      color(pow(vec3(col), vec3(.1))+normal)
      sphere(col*.005+.5)
      `
  } else if (shader == 'test3') {
    return `
      let size = input()
      let pointerDown = input()
      let octahedron = glslSDF(\`
      //https://iquilezles.org/articles/distfunctions/
      float sdOctahedron( vec3 p, float s){
        p = abs(p);
        float m = p.x+p.y+p.z-s;
        vec3 q;
            if( 3.0*p.x < m ) q = p.xyz;
        else if( 3.0*p.y < m ) q = p.yzx;
        else if( 3.0*p.z < m ) q = p.zxy;
        else return m*0.57735027;
          
        float k = clamp(0.5*(q.z-q.y+s),0.0,s); 
        return length(vec3(q.x,q.y-s+k,q.z-k)); 
      }\`);

      rotateY(mouse.x * 2 * PI / 2 + time + size * .10)
      rotateX(mouse.y * 2 * PI / 2 + time + size * .10)
      rotateZ(size*.10)
      metal(.5)
      color(normalize(getRayDirection())+.2-pointerDown)
      rotateY(getRayDirection().y*4+time*size)
      grid(2.4, .1*size, .2);
      shine(.4)
      expand(-.02*size+.02)
      blend(nsin(time*(size+1))*0.1+0.1+pointerDown*.25)
      grid(2.4, .1*size, .2);
      blend(ncos(time*(size+1))*0.1+0.1+pointerDown*.25)
      octahedron(size)
    `
  } else if (shader == 'example') {
    return `
      
      let size = input();
      let pointerDown = input();

      setMaxIterations(5)

      displace(mouse.x*2, mouse.y*2, 0)

      let s = getSpace();
      let r = getRayDirection();
      let n = noise(r*4 + vec3(0,0,size*5));
      let n1 = noise(s + vec3(0,0,size*5) + n);

      metal(.5*n1 + .5)
      shine(.5*n1 + .5)

      color(normal*.1 + vec3(0,0,1))
      boxFrame(vec3(2), .1);
      mixGeo(pointerDown);
      sphere(.5 + n1 * .5);
    `
  } else if (shader == 'react') {
    return `
      let size = input();
      let pointerDown = input();

      setMaxIterations(5)

      displace(mouse.x*2, mouse.y*2, 0)

      let s = getSpace();
      let r = getRayDirection();
      let n = noise(r*4 + vec3(0,0,size*5));
      let n1 = noise(s + vec3(0,0,size*5) + n);

      metal(.5*n1 + .5)
      shine(.5*n1 + .5)

      color(normal*.1 + vec3(0,0,1))
      boxFrame(vec3(2), .1);
      mixGeo(pointerDown);
      sphere(.5 + n1 * .5);
    `
  } else if (shader == 'gpt-1') {
    return `
    let size = input();
    let pointerDown = input();
    
    // Randomly choose a shape to render
    let shapeChoice = Math.random() > 0.5 ? 'sphere' : 'boxFrame'; // Randomly choose between sphere and boxFrame
    
    // Random color selection
    let colorChoice = Math.random();
    if (colorChoice < 0.3) {
      color(Math.random() * 0.5, Math.random() * 0.5, Math.random() * 0.5); // Random dark color
    } else if (colorChoice < 0.6) {
      color(Math.random() * 0.5 + 0.5, Math.random() * 0.5, 0); // Random warm colors
    } else {
      color(Math.random() * 0.5, Math.random() * 0.5 + 0.5, Math.random() * 0.5); // Random cool colors
    }

    // Rotate in random directions
    rotateX(Math.random() * Math.PI * 2);
    rotateY(Math.random() * Math.PI * 2);
    rotateZ(Math.random() * Math.PI * 2);

    // Dynamic rotation and scaling based on time and size
    let randomTimeFactor = Math.random() * 0.1 + 0.1;
    rotateX(mouse.y * 5 * Math.PI / 2 + time * randomTimeFactor);
    rotateY(mouse.x * -5 * Math.PI / 2 + time * randomTimeFactor);

    // Metal and shine with random factors
    let randomMetal = Math.random() * 0.5 + 0.3;
    metal(randomMetal * size);
    shine(Math.random() * 0.5 + 0.3);

    // Randomly adjust the size
    size *= Math.random() * 1.5 + 0.5;

    // Box or Sphere with random size adjustments
    if (shapeChoice === 'sphere') {
      sphere(size / 2 - pointerDown * 0.3);
    } else {
      let boxSize = size - pointerDown * 0.1;
      boxFrame(vec3(size), boxSize * 0.1);
    }

    // Apply blending effects with random factors
    let randomBlend = Math.random() * 0.2 + 0.1;
    blend(nsin(time * size) * randomBlend);

    // Create an additional shape, randomly chosen between sphere, boxFrame, or grid
    let extraShape = Math.random();
    if (extraShape < 0.33) {
      sphere(size / 3);
    } else if (extraShape < 0.66) {
      boxFrame(vec3(size * 0.7), size * 0.05);
    } else {
      grid(size / 3, 10, 0.01 * size);
    }

    // Add some randomness to the blending intensity
    blend(ncos(time * (size)) * (Math.random() * 0.2 + 0.1));
    `
  } else if (shader == 'gpt-3') {
    return `
    let size = input();
    let pointerDown = input();
    
     rotateY(mouse.x * -5 * PI / 2 + time -(pointerDown+0.1))
      rotateX(mouse.y * 5 * PI / 2 + time)

    // Randomly choose a shape to render
    let shapeChoice = Math.random() > 0.5 ? 'sphere' : 'boxFrame'; // Randomly choose between sphere and boxFrame
    
    // Random color selection
    let colorChoice = Math.random();
    if (colorChoice < 0.3) {
      color(Math.random() * 0.5, Math.random() * 0.5, Math.random() * 0.5); // Random dark color
    } else if (colorChoice < 0.6) {
      color(Math.random() * 0.5 + 0.5, Math.random() * 0.5, 0); // Random warm colors
    } else {
      color(Math.random() * 0.5, Math.random() * 0.5 + 0.5, Math.random() * 0.5); // Random cool colors
    }

    // Randomize rotation using getRayDirection and time
    let randomRotateFactor = Math.random() * 2 + 1; // Random factor for more variation in rotations
    rotateX(getRayDirection().y * randomRotateFactor + time);
    rotateY(getRayDirection().x * randomRotateFactor + time);
    rotateZ(getRayDirection().z * randomRotateFactor + time);
    
    // Metal and shine with random factors
    let randomMetal = Math.random() * 0.5 + 0.3;
    metal(randomMetal * size);
    shine(Math.random() * 0.5 + 0.3);

    // Randomize size adjustment but ensure it doesn't shrink too small on pointerDown
    let adjustedSize = size - pointerDown * 0.05; // Shrink by a small amount when clicked, only minimally
    
    // Box or Sphere with random size adjustments
    if (shapeChoice === 'sphere') {
      sphere(max(0.1, adjustedSize / 2)); // Ensure it doesn't shrink to 0
    } else {
      let boxThickness = max(0.1, size * 0.1); // Limit frame thickness to prevent too thick frames
      boxFrame(vec3(adjustedSize), boxThickness);
    }

    // Apply blending effects with random factors
    let randomBlend = Math.random() * 0.2 + 0.1;
    blend(nsin(time * size) * randomBlend);

    // Create an additional shape, randomly chosen between sphere, boxFrame, or grid
    let extraShape = Math.random();
    if (extraShape < 0.33) {
      sphere(adjustedSize / 3);
    } else if (extraShape < 0.66) {
      boxFrame(vec3(adjustedSize * 0.7), adjustedSize * 0.05);
    } else {
      grid(adjustedSize / 3, 10, 0.01 * adjustedSize);
    }

    // Add some randomness to the blending intensity
    blend(ncos(time * (size)) * (Math.random() * 0.2 + 0.1));
    `
  }
    else if (shader == 'gpt-2') { 
    return `
     let size = input();
    let pointerDown = input();
    color(0.2, 1, 0.4); // Light green sphere
    metal(0.4 * size);
    rotateZ(time * 0.1); // Rotation in Z axis
    sphere(max(0.1, size * 1.2 - pointerDown * 0.1)); // Allow sphere to move dynamically at lower sizes
    color(1, 0.8, 0); // Yellow boxFrame
    boxFrame(vec3(max(0.1, size - pointerDown * 0.1), max(0.1, size - pointerDown * 0.1), max(0.1, size - pointerDown * 0.1)), 0.1); 
    `
  } else if (shader == 'generate') {
    const shapes = [
      () => `sphere(${(Math.random() * 0.5 + 0.2).toFixed(2)})`, // Random radius
      () => `box(vec3(${(Math.random() * 0.5 + 0.2).toFixed(2)}, ${(Math.random() * 0.5 + 0.2).toFixed(2)}, ${(Math.random() * 0.5 + 0.2).toFixed(2)}))`, // Random dimensions
      () => `torus(${(Math.random() * 0.3 + 0.1).toFixed(2)}, ${(Math.random() * 0.1 + 0.05).toFixed(2)})`, // Random major and minor radius
      () => `cone(${(Math.random() * 0.5 + 0.2).toFixed(2)}, ${(Math.random() * 0.5 + 0.2).toFixed(2)})`, // Random height and radius
    ];
  
    const randomShapeGenerator = shapes[Math.floor(Math.random() * shapes.length)];
    const randomShape = randomShapeGenerator(); // Generate the shape with appropriate parameters
  
    return `
      let size = input()
      let mouseDown = input()
      // Random ShaderPark Shader
      setMaxIterations(150);
      let t = time;
      let shape = ${randomShape};
      shape = shape.scale(vec3(0.5)).rotateX(sin(t) * 3.14).rotateY(cos(t) * 3.14);
      let color = vec3(abs(sin(t)), abs(cos(t)), abs(sin(t * 0.5)));
      shape.color(color);
    `;
  }
}

//
// let size = input();
// rotateY(mouse.x * PI / 2 + time*.5)
// rotateX(mouse.y * PI / 2 + time*.5)
// rotateZ(mouse.x - mouse.y * PI / 2 + time*.5)
// metal(.5)
// color(getRayDirection()+.2)
// rotateY(getRayDirection().y*4+time)
// boxFrame(vec3(size), size/2)
// shine(.4)
// expand(.02)
// blend(nsin(time)*.6)
// sphere(size/2)