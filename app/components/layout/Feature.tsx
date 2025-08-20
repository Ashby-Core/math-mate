import React from "react";
import Image from "next/image";

interface FeatureProps {
  title: string;
  description: string;
  imageOnRight: boolean;
}

const Feature = ({ title, description, imageOnRight }: FeatureProps) => {
  return (
    <div
      className={"flex justify-center px-6 py-12 gap-16"}
      style={
        imageOnRight
          ? { flexDirection: "row" }
          : { flexDirection: "row-reverse" }
      }
    >
      <div>
        <h3 className="text-2xl max-w-">{title}</h3>
        <p>{description}</p>
      </div>
      <div>
        <Image
          src="https://placehold.co/560x560"
          alt="Image"
          width={560}
          height={560}
          unoptimized
        />
      </div>
    </div>
  );
};

export default Feature;
