# Image Dimensions Test

This document tests that ODT image dimensions are preserved when converting to Markdown.

## Small Image

<img src="small-image.png" alt="Small test image" style="width:2.0in; height:1.5in;" />

## Medium Image

<img src="medium-image.jpg" alt="Medium test image" style="width:4.5in; height:3.2in;" />

## Large Image

<img src="large-image.png" alt="Large test image" style="width:6.5in; height:4.8in;" />

## Image with Centimeters

<img src="metric-image.png" alt="Metric dimensions" style="width:12.3cm; height:6.7cm;" />

## Image with Millimeters

<img src="mm-image.jpg" alt="Millimeter dimensions" style="width:120mm; height:80mm;" />

These images should maintain their relative sizes when rendered.
