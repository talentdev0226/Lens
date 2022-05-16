/**
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import styles from "./avatar.module.scss";

import type { ImgHTMLAttributes, MouseEventHandler } from "react";
import React from "react";
import randomColor from "randomcolor";
import GraphemeSplitter from "grapheme-splitter";
import type { SingleOrMany } from "../../utils";
import { cssNames, isDefined, iter } from "../../utils";

export interface AvatarProps {
  title: string;
  colorHash?: string;
  size?: number;
  src?: string;
  background?: string;
  variant?: "circle" | "rounded" | "square";
  imgProps?: ImgHTMLAttributes<HTMLImageElement>;
  disabled?: boolean;
  children?: SingleOrMany<React.ReactNode>;
  className?: string;
  id?: string;
  onClick?: MouseEventHandler<HTMLDivElement>;
  "data-testid"?: string;
}

function getNameParts(name: string): string[] {
  const byWhitespace = name.split(/\s+/);

  if (byWhitespace.length > 1) {
    return byWhitespace;
  }

  const byDashes = name.split(/[-_]+/);

  if (byDashes.length > 1) {
    return byDashes;
  }

  return name.split(/@+/);
}

function getLabelFromTitle(title: string) {
  if (!title) {
    return "??";
  }

  const [rawFirst, rawSecond, rawThird] = getNameParts(title);
  const splitter = new GraphemeSplitter();
  const first = splitter.iterateGraphemes(rawFirst);
  const second = rawSecond ? splitter.iterateGraphemes(rawSecond): first;
  const third = rawThird ? splitter.iterateGraphemes(rawThird) : iter.newEmpty();

  return [
    ...iter.take(first, 1),
    ...iter.take(second, 1),
    ...iter.take(third, 1),
  ].filter(isDefined).join("");
}

export const Avatar = ({
  title,
  variant = "rounded",
  size = 32,
  colorHash,
  children,
  background,
  imgProps,
  src,
  className,
  disabled,
  id,
  onClick,
  "data-testid": dataTestId,
}: AvatarProps) => (
  <div
    className={cssNames(styles.Avatar, {
      [styles.circle]: variant == "circle",
      [styles.rounded]: variant == "rounded",
      [styles.disabled]: disabled,
    }, className)}
    style={{
      width: `${size}px`,
      height: `${size}px`,
      background: background || (
        src
          ? "transparent"
          : randomColor({ seed: colorHash, luminosity: "dark" })
      ),
    }}
    id={id}
    onClick={onClick}
    data-testid={dataTestId}
  >
    {src
      ? (
        <img
          src={src}
          {...imgProps}
          alt={title}
        />
      )
      : children || getLabelFromTitle(title)}
  </div>
);
