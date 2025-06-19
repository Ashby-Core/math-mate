import Feature from "./components/layout/Feature";
import Navbar from "./components/layout/Navbar";
import Button from "./components/ui/Button";
import Image from "next/image";

export default function Home() {
  return (
    <div>
      <Navbar></Navbar>
      <div className="flex flex-1 w-full justify-center items-center px-6 py-12 gap-60">
        <div className="max-w-2xl text-right mr-12">
          <h1 className="text-6xl font-bold mb-6">
            A Simpler, Personalized, Fun Way to Learn
          </h1>
          <Button text="Learn More" />
        </div>
        <div>
          <Image
            src="https://placehold.co/600x400"
            alt="Image"
            width={600}
            height={400}
            unoptimized
          />
        </div>
      </div>
      <div>
        <h2 className="text-3xl text-center font-semibold">Features</h2>
        <Feature
          title="Create assignments and track student progress"
          description="Mi tincidunt elit, id quisque ligula ac diam, amet. Vel etiam suspendisse morbi eleifend faucibus eget vestibulum felis. Dictum quis montes, sit sit. Tellus aliquam enim urna, etiam. Mauris posuere vulputate arcu amet, vitae nisi, tellus tincidunt. At feugiat sapien varius id."
          imageOnRight={true}
        />
        <Feature
          title="See all of your assignments in one place"
          description="Mi tincidunt elit, id quisque ligula ac diam, amet. Vel etiam suspendisse morbi eleifend faucibus eget vestibulum felis. Dictum quis montes, sit sit. Tellus aliquam enim urna, etiam. Mauris posuere vulputate arcu amet, vitae nisi, tellus tincidunt. At feugiat sapien varius id."
          imageOnRight={false}
        />
        <Feature
          title="Learn topics at your own pace"
          description="Mi tincidunt elit, id quisque ligula ac diam, amet. Vel etiam suspendisse morbi eleifend faucibus eget vestibulum felis. Dictum quis montes, sit sit. Tellus aliquam enim urna, etiam. Mauris posuere vulputate arcu amet, vitae nisi, tellus tincidunt. At feugiat sapien varius id."
          imageOnRight={true}
        />
        <Feature
          title="Use AI to practice concepts"
          description="Mi tincidunt elit, id quisque ligula ac diam, amet. Vel etiam suspendisse morbi eleifend faucibus eget vestibulum felis. Dictum quis montes, sit sit. Tellus aliquam enim urna, etiam. Mauris posuere vulputate arcu amet, vitae nisi, tellus tincidunt. At feugiat sapien varius id."
          imageOnRight={false}
        />
        <Feature
          title="Gamify the learning process"
          description="Mi tincidunt elit, id quisque ligula ac diam, amet. Vel etiam suspendisse morbi eleifend faucibus eget vestibulum felis. Dictum quis montes, sit sit. Tellus aliquam enim urna, etiam. Mauris posuere vulputate arcu amet, vitae nisi, tellus tincidunt. At feugiat sapien varius id."
          imageOnRight={true}
        />
        <Feature
          title="Know exactly what you need to work on"
          description="Mi tincidunt elit, id quisque ligula ac diam, amet. Vel etiam suspendisse morbi eleifend faucibus eget vestibulum felis. Dictum quis montes, sit sit. Tellus aliquam enim urna, etiam. Mauris posuere vulputate arcu amet, vitae nisi, tellus tincidunt. At feugiat sapien varius id."
          imageOnRight={false}
        />
      </div>
    </div>
  );
}
